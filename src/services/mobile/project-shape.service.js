"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeAttachments = exports.shapeProject = exports.shapeProjects = void 0;
const db_js_1 = require("../config/db.js");
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const parseAttachments = (raw) => {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((item) => {
                if (typeof item === 'string')
                    return item;
                if (item && typeof item === 'object' && item.url)
                    return String(item.url);
                return '';
            })
                .filter(Boolean);
        }
    }
    catch {
        // comma-separated fallback
    }
    return String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
};
const splitIds = (raw) => String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
/**
 * Enrich project rows with human-readable names (never expose raw IDs in display fields).
 */
const shapeProjects = async (projects, viewerUserId) => {
    if (!projects.length)
        return [];
    const clientIds = [...new Set(projects.map((p) => p.client).filter(Boolean))];
    const categoryIds = [
        ...new Set(projects
            .map((p) => p.category)
            .filter((c) => c && uuidLike.test(c))),
    ];
    const skillIds = [
        ...new Set(projects.flatMap((p) => splitIds(p.technology)).filter((id) => uuidLike.test(id))),
    ];
    const [clients, categories, skills] = await Promise.all([
        clientIds.length
            ? db_js_1.prisma.user.findMany({
                where: { id: { in: clientIds } },
                select: { id: true, fullName: true, avatarUrl: true, isVerified: true },
            })
            : Promise.resolve([]),
        categoryIds.length
            ? db_js_1.prisma.skillCategory.findMany({
                where: { id: { in: categoryIds } },
                select: { id: true, name: true },
            })
            : Promise.resolve([]),
        skillIds.length
            ? db_js_1.prisma.skill.findMany({
                where: { id: { in: skillIds } },
                select: { id: true, name: true },
            })
            : Promise.resolve([]),
    ]);
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const skillById = new Map(skills.map((s) => [s.id, s.name]));
    const proposalCounts = await db_js_1.prisma.proposal.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projects.map((p) => p.id) } },
        _count: { id: true },
    }).catch((err) => {
        console.error('[shapeProjects] proposal groupBy failed:', err);
        return [];
    });
    const countByProject = new Map(proposalCounts.map((row) => [row.projectId, row._count.id]));
    return projects.map((project) => {
        const client = clientById.get(project.client);
        const skillIdList = splitIds(project.technology);
        const skillNames = skillIdList.map((id) => skillById.get(id) ?? id);
        const categoryName = uuidLike.test(String(project.category || ''))
            ? categoryById.get(project.category) ?? 'General'
            : project.category || 'General';
        return {
            id: project.id,
            title: project.title,
            description: project.description ?? '',
            clientId: project.client,
            clientName: client?.fullName || 'Client',
            clientAvatar: client?.avatarUrl ?? null,
            clientVerified: Boolean(client?.isVerified),
            category: categoryName,
            categoryId: uuidLike.test(String(project.category || ''))
                ? project.category
                : null,
            skills: skillNames,
            skillIds: skillIdList,
            techStack: skillNames,
            technology: skillNames.join(', '),
            budget: project.budget,
            budgetMin: project.budgetMin ?? project.budget,
            budgetMax: project.budgetMax ?? project.budget,
            isHourly: false,
            timeline: project.timeline ?? '',
            workMode: project.workMode ?? 'Remote',
            experienceLevel: (() => {
                const raw = String(project.experienceLevel ?? 'intermediate')
                    .trim()
                    .toLowerCase();
                if (raw === 'beginner' || raw === 'entry' || raw === 'junior')
                    return 'beginner';
                if (raw === 'expert' || raw === 'senior' || raw === 'advanced')
                    return 'expert';
                return 'intermediate';
            })(),
            attachments: parseAttachments(project.attachments),
            status: project.status,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            proposalsCount: countByProject.get(project.id) ?? 0,
            shareCount: project.shareCount ?? 0,
            isOwner: Boolean(viewerUserId && viewerUserId === project.client),
            milestones: project.milestones,
            tasks: project.tasks,
            proposals: undefined,
        };
    });
};
exports.shapeProjects = shapeProjects;
const shapeProject = async (project, viewerUserId) => {
    const [shaped] = await (0, exports.shapeProjects)([project], viewerUserId);
    return shaped;
};
exports.shapeProject = shapeProject;
const serializeAttachments = (attachments) => {
    if (!attachments)
        return null;
    const imageExt = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|svg|ico|tif|tiff)(\?|$)/i;
    const toUrls = (items) => items
        .map((item) => {
        if (typeof item === 'string')
            return item.trim();
        if (item && typeof item === 'object' && item.url) {
            return String(item.url).trim();
        }
        return '';
    })
        .filter(Boolean)
        .filter((url) => !imageExt.test(url));
    let urls = [];
    if (typeof attachments === 'string') {
        try {
            const parsed = JSON.parse(attachments);
            urls = Array.isArray(parsed) ? toUrls(parsed) : toUrls([attachments]);
        }
        catch {
            urls = toUrls(attachments
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean));
        }
    }
    else if (Array.isArray(attachments)) {
        urls = toUrls(attachments);
    }
    else {
        return null;
    }
    // Cap at 20 project attachments.
    urls = [...new Set(urls)].slice(0, 20);
    return JSON.stringify(urls);
};
exports.serializeAttachments = serializeAttachments;
