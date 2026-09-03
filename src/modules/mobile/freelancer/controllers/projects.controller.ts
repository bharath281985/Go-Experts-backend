import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';
import { shapeProject, shapeProjects } from '../../../../services/mobile/project-shape.service.js';

export const listProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where: { freelancer: req.user.id }, skip, take: limit }),
      prisma.project.count({ where: { freelancer: req.user.id } })
    ]);

    const mapped = await shapeProjects(projects, req.user?.id);
    return res.json(successResponse('Projects retrieved', mapped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
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
    const query = (req.query.q as string) || '';
    const projects = await prisma.project.findMany({ where: { status: 'open', title: { contains: query } }, take: 20 });
    const mapped = await shapeProjects(projects, req.user?.id);
    return res.json(successResponse('Search results', mapped));
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
