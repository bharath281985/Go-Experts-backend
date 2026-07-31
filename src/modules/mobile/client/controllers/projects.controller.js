import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { shapeProject, shapeProjects, serializeAttachments, } from '../../../../services/mobile/project-shape.service.js';
import { parseProjectListQuery } from '../../../../services/mobile/project-list-query.service.js';
const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'expert'];
/** Normalize UI/legacy labels to enum keys: beginner | intermediate | expert */
const normalizeExperienceLevel = (value) => {
    if (value === undefined)
        return undefined;
    if (value == null || value === '')
        return null;
    const raw = String(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
    const aliases = {
        beginner: 'beginner',
        entry: 'beginner',
        entry_level: 'beginner',
        junior: 'beginner',
        intermediate: 'intermediate',
        mid: 'intermediate',
        mid_level: 'intermediate',
        expert: 'expert',
        senior: 'expert',
        advanced: 'expert',
    };
    return aliases[raw] ?? null;
};
const parseBudget = (body) => {
    const max = body.budgetMax ?? body.budget;
    const min = body.budgetMin ?? body.budget ?? max;
    return {
        budget: max != null ? parseFloat(String(max)) : undefined,
        budgetMin: min != null ? parseFloat(String(min)) : undefined,
        budgetMax: max != null ? parseFloat(String(max)) : undefined,
    };
};
const technologyFromBody = (body) => {
    const rawSkillIds = body.skillIds ?? body.skills;
    if (Array.isArray(rawSkillIds))
        return rawSkillIds.join(',');
    if (typeof rawSkillIds === 'string')
        return rawSkillIds;
    if (typeof body.technology === 'string')
        return body.technology;
    return undefined;
};
export const listProjects = async (req, res, next) => {
    try {
        const { where, orderBy, page, limit, skip } = parseProjectListQuery(req, {
            kind: 'client',
            clientId: req.user.id,
        });
        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                skip,
                take: limit,
                orderBy,
            }),
            prisma.project.count({ where }),
        ]);
        let shaped;
        try {
            shaped = await shapeProjects(projects, req.user.id);
        }
        catch (shapeErr) {
            console.error('[client/projects] shapeProjects failed:', shapeErr);
            shaped = projects.map((raw) => {
                const project = raw;
                return {
                    ...project,
                    clientId: project.client,
                    clientName: 'Client',
                    category: project.category,
                    skills: String(project.technology || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    skillIds: [],
                    budgetMin: project.budgetMin ?? project.budget,
                    budgetMax: project.budgetMax ?? project.budget,
                    workMode: project.workMode ?? 'Remote',
                    experienceLevel: normalizeExperienceLevel(project.experienceLevel) ?? 'intermediate',
                    attachments: [],
                    proposalsCount: 0,
                    isOwner: true,
                };
            });
        }
        return res.json(successResponse('Projects retrieved', shaped, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }));
    }
    catch (error) {
        console.error('[client/projects] listProjects failed:', error);
        next(error);
    }
};
export const createProject = async (req, res, next) => {
    try {
        const { title, category, categoryId, timeline, deadline, description, workMode, experienceLevel, attachments, } = req.body;
        const categoryValue = categoryId || category || 'General';
        const technologyValue = technologyFromBody(req.body) || '';
        const budgets = parseBudget(req.body);
        const level = normalizeExperienceLevel(experienceLevel);
        if (experienceLevel != null && experienceLevel !== '' && level === null) {
            return res.status(400).json(errorResponse(`experienceLevel must be one of: ${EXPERIENCE_LEVELS.join(', ')}`, 'VALIDATION_ERROR'));
        }
        if (Array.isArray(attachments) && attachments.length > 20) {
            return res.status(400).json(errorResponse('Maximum 20 attachments allowed', 'VALIDATION_ERROR'));
        }
        if (!title || budgets.budget == null || Number.isNaN(budgets.budget)) {
            return res.status(400).json(errorResponse('Title and budget are required', 'VALIDATION_ERROR'));
        }
        const project = await prisma.project.create({
            data: {
                title,
                client: req.user.id,
                category: categoryValue,
                technology: technologyValue,
                budget: budgets.budget,
                budgetMin: budgets.budgetMin,
                budgetMax: budgets.budgetMax,
                timeline: timeline || deadline || null,
                description: description || null,
                workMode: workMode || null,
                experienceLevel: level ?? 'intermediate',
                attachments: serializeAttachments(attachments),
                status: 'draft',
            },
        });
        const shaped = await shapeProject(project, req.user.id);
        return res.status(201).json(successResponse('Project created', shaped));
    }
    catch (error) {
        next(error);
    }
};
export const getProjectDetails = async (req, res, next) => {
    try {
        const project = await prisma.project.findFirst({
            where: { id: req.params.id, client: req.user.id, deletedAt: null },
            include: { milestones: true, tasks: true },
        });
        if (!project)
            return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
        const shaped = await shapeProject(project, req.user.id);
        return res.json(successResponse('Project details', shaped));
    }
    catch (error) {
        next(error);
    }
};
/** Single update API — fields + attachments together. */
export const updateProject = async (req, res, next) => {
    try {
        const existing = await prisma.project.findFirst({
            where: { id: req.params.id, client: req.user.id, deletedAt: null },
        });
        if (!existing)
            return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
        const { title, category, categoryId, timeline, deadline, description, workMode, experienceLevel, attachments, status, } = req.body;
        const categoryValue = categoryId ?? category;
        const technologyValue = technologyFromBody(req.body);
        const budgets = parseBudget(req.body);
        const level = normalizeExperienceLevel(experienceLevel);
        if (experienceLevel != null && experienceLevel !== '' && level === null) {
            return res.status(400).json(errorResponse(`experienceLevel must be one of: ${EXPERIENCE_LEVELS.join(', ')}`, 'VALIDATION_ERROR'));
        }
        if (Array.isArray(attachments) && attachments.length > 20) {
            return res.status(400).json(errorResponse('Maximum 20 attachments allowed', 'VALIDATION_ERROR'));
        }
        const data = {};
        if (title != null)
            data.title = title;
        if (categoryValue != null)
            data.category = categoryValue;
        if (technologyValue != null)
            data.technology = technologyValue;
        if (budgets.budget != null && !Number.isNaN(budgets.budget))
            data.budget = budgets.budget;
        if (budgets.budgetMin != null && !Number.isNaN(budgets.budgetMin))
            data.budgetMin = budgets.budgetMin;
        if (budgets.budgetMax != null && !Number.isNaN(budgets.budgetMax))
            data.budgetMax = budgets.budgetMax;
        if (timeline != null || deadline != null)
            data.timeline = timeline ?? deadline;
        if (description != null)
            data.description = description;
        if (workMode != null)
            data.workMode = workMode;
        if (level !== undefined)
            data.experienceLevel = level;
        if (attachments != null)
            data.attachments = serializeAttachments(attachments);
        if (status != null)
            data.status = status;
        const project = await prisma.project.update({
            where: { id: existing.id },
            data,
        });
        const shaped = await shapeProject(project, req.user.id);
        return res.json(successResponse('Project updated', shaped));
    }
    catch (error) {
        next(error);
    }
};
export const deleteProject = async (req, res, next) => {
    try {
        const result = await prisma.project.updateMany({
            where: { id: req.params.id, client: req.user.id, deletedAt: null },
            data: { status: 'cancelled', deletedAt: new Date() },
        });
        if (result.count === 0) {
            return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
        }
        return res.json(successResponse('Project deleted'));
    }
    catch (error) {
        next(error);
    }
};
export const updateProjectStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json(errorResponse('Status is required', 'VALIDATION_ERROR'));
        }
        const result = await prisma.project.updateMany({
            where: { id: req.params.id, client: req.user.id, deletedAt: null },
            data: { status },
        });
        if (result.count === 0) {
            return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
        }
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        const shaped = project ? await shapeProject(project, req.user.id) : null;
        return res.json(successResponse('Project status updated', shaped));
    }
    catch (error) {
        next(error);
    }
};
export const addAttachment = async (req, res, next) => {
    try {
        // Prefer PUT /projects/:id with attachments[]; keep route for compatibility.
        const existing = await prisma.project.findFirst({
            where: { id: req.params.id, client: req.user.id, deletedAt: null },
        });
        if (!existing)
            return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
        const incoming = req.body?.url || req.body?.attachments;
        const current = serializeAttachments(existing.attachments);
        const merged = [
            ...JSON.parse(current || '[]'),
            ...(Array.isArray(incoming) ? incoming : [incoming]).filter(Boolean),
        ];
        const project = await prisma.project.update({
            where: { id: existing.id },
            data: { attachments: JSON.stringify(merged) },
        });
        const shaped = await shapeProject(project, req.user.id);
        return res.json(successResponse('Attachment added', shaped));
    }
    catch (error) {
        next(error);
    }
};
export const getProjectTimeline = async (req, res, next) => {
    try {
        const project = await prisma.project.findFirst({
            where: { id: req.params.id, client: req.user.id },
            include: { milestones: true, tasks: true },
        });
        return res.json(successResponse('Project timeline', project));
    }
    catch (error) {
        next(error);
    }
};
/** Track project shares (whatsapp / email / etc.). Owners or any authenticated client. */
export const shareProject = async (req, res, next) => {
    try {
        const platform = String(req.body?.platform || 'other').trim().toLowerCase() || 'other';
        const existing = await prisma.project.findFirst({
            where: { id: req.params.id, deletedAt: null },
        });
        if (!existing) {
            return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
        }
        let shareCount = existing.shareCount ?? 0;
        try {
            const updated = await prisma.project.update({
                where: { id: existing.id },
                data: { shareCount: { increment: 1 } },
            });
            shareCount = updated.shareCount ?? shareCount + 1;
        }
        catch {
            // Column may be missing before migration — still acknowledge share.
            shareCount += 1;
        }
        return res.json(successResponse('Project share recorded', {
            projectId: existing.id,
            platform,
            shareCount,
            shareUrl: `https://goexperts.in/projects/${existing.id}`,
        }));
    }
    catch (error) {
        next(error);
    }
};
