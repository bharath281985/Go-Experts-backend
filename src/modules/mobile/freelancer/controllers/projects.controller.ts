import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';
import { shapeProject, shapeProjects } from '../../../../services/mobile/project-shape.service.js';

const parseQueryList = (value: unknown): string[] =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const listProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const skip = (page - 1) * limit;
    const q = ((req.query.q as string) || '').trim();
    const status = String(req.query.status || '').trim();
    const categories = [
      ...parseQueryList(req.query.category || req.query.categories),
      ...parseQueryList(req.query.categoryId || req.query.categoryIds || req.query.industryId || req.query.industry),
    ];
    const workModes = parseQueryList(req.query.workMode || req.query.workModes || req.query.work_mode);
    const experienceLevels = parseQueryList(
      req.query.experienceLevel || req.query.experienceLevels || req.query.experience_level,
    );
    const andFilters: any[] = [];

    const where: any = {
      deletedAt: null,
      OR: [{ freelancer: req.user.id }, { client: req.user.id }],
    };
    if (status) where.status = status;

    if (q) {
      const matchingSkills = q.length >= 2
        ? await prisma.skill.findMany({
          where: { name: { contains: q }, status: 'active' },
          select: { id: true, name: true },
          take: 20,
        }).catch(() => [])
        : [];
      const technologySearchValues = [
        q,
        ...matchingSkills.map((skill) => skill.name),
      ].filter(Boolean);
      andFilters.push({ OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
        { workMode: { contains: q } },
        { experienceLevel: { contains: q } },
        ...technologySearchValues.map((value) => ({
          technology: { contains: value },
        })),
      ] });
    }
    if (categories.length === 1) {
      andFilters.push({ category: categories[0] });
    } else if (categories.length > 1) {
      andFilters.push({ category: { in: categories } });
    }
    if (workModes.length === 1) {
      andFilters.push({ workMode: workModes[0] });
    } else if (workModes.length > 1) {
      andFilters.push({ workMode: { in: workModes } });
    }
    if (experienceLevels.length === 1) {
      andFilters.push({ experienceLevel: experienceLevels[0] });
    } else if (experienceLevels.length > 1) {
      andFilters.push({ experienceLevel: { in: experienceLevels } });
    }
    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({ where })
    ]);

    const mapped = await shapeProjects(projects, req.user?.id);
    return res.json(successResponse('Projects retrieved', mapped, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  } catch (error) { next(error); }
};

export const getProjectDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null
      },
      include: { milestones: true, tasks: true }
    });
    
    if (!project) {
      return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
    }
    
    const shaped = await shapeProject(project, req.user?.id);
    return res.json(successResponse('Project details retrieved', shaped));
  } catch (error) { next(error); }
};

export const searchProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] },
      proposals: {
        none: {
          freelancerId: req.user.id,
          status: 'accepted',
          deletedAt: null,
        },
      },
    };

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
        { technology: { contains: q } },
        { workMode: { contains: q } },
        { experienceLevel: { contains: q } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.project.count({ where }),
    ]);

    const mapped = await shapeProjects(projects, req.user?.id);
    return res.json(successResponse('Search results', mapped, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  } catch (error) { next(error); }
};

export const appliedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Applied projects', []));
export const invitedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Invited projects', []));

export const saveProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;
    if (!projectId) return res.status(400).json(errorResponse('Project ID is required'));

    const saved = await getJsonSetting(userId, 'saved-projects', [] as string[]);
    if (saved.includes(projectId)) {
      const nextSaved = saved.filter((id) => id !== projectId);
      await setJsonSetting(userId, 'saved-projects', nextSaved);
      return res.json(successResponse('Project removed from saved list', { isSaved: false }));
    }

    saved.push(projectId);
    await setJsonSetting(userId, 'saved-projects', saved);

    res.status(200).json(successResponse('Project saved', { isSaved: true }));
  } catch (err) { next(err); }
};

export const unsaveProject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const projectId = req.params.id;
    if (!projectId) return res.status(400).json(errorResponse('Project ID is required'));

    const saved = await getJsonSetting(userId, 'saved-projects', [] as string[]);
    const nextSaved = saved.filter((id) => id !== projectId);
    await setJsonSetting(userId, 'saved-projects', nextSaved);

    res.json(successResponse('Project removed from saved list', { isSaved: false }));
  } catch (err) { next(err); }
};

export const savedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const saved = await getJsonSetting(userId, 'saved-projects', [] as string[]);
    
    if (!saved || saved.length === 0) {
      return res.json(successResponse('Saved projects', [], { page, limit, total: 0, totalPages: 0 }));
    }
    
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: { id: { in: saved }, deletedAt: null },
        include: { 
          milestones: true, 
          tasks: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.project.count({
        where: { id: { in: saved }, deletedAt: null }
      })
    ]);
    
    const shaped = await shapeProjects(projects, userId);
    return res.json(successResponse('Saved projects', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  } catch (err) { next(err); }
};
export const recommendedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Recommended projects', []));
export const nearbyProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Nearby projects', []));
