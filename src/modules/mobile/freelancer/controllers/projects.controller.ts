import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';

export const listProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where: { freelancer: req.user.id }, skip, take: limit }),
      prisma.project.count({ where: { freelancer: req.user.id } })
    ]);
    return res.json(successResponse('Projects retrieved', projects, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getProjectDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { freelancer: req.user.id },
          { status: 'open' }
        ]
      },
      include: { milestones: true, tasks: true }
    });
    
    if (!project) {
      return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
    }
    
    return res.json(successResponse('Project details retrieved', project));
  } catch (error) { next(error); }
};

export const searchProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string) || '';
    const projects = await prisma.project.findMany({ where: { status: 'open', title: { contains: query } }, take: 20 });
    return res.json(successResponse('Search results', projects));
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
    if (!saved.includes(projectId)) saved.push(projectId);
    await setJsonSetting(userId, 'saved-projects', saved);

    res.status(201).json(successResponse('Project saved'));
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

    res.json(successResponse('Project removed from saved list'));
  } catch (err) { next(err); }
};

export const savedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const saved = await getJsonSetting(userId, 'saved-projects', [] as string[]);
    
    if (saved.length === 0) {
      return res.json(successResponse('Saved projects', []));
    }
    
    const projects = await prisma.project.findMany({
      where: { id: { in: saved }, deletedAt: null },
      include: { 
        milestones: true, 
        tasks: true
      }
    });
    
    // Fetch client details for these projects
    const clientIds = [...new Set(projects.map((p) => p.client).filter(Boolean))];
    const clients = await prisma.user.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, fullName: true, avatarUrl: true }
    });
    const clientMap = new Map(clients.map((c) => [c.id, c]));
    
    // Map projects to include the client object
    const populatedProjects = projects.map((project) => ({
      ...project,
      clientDetails: clientMap.get(project.client) || null
    }));
    
    res.json(successResponse('Saved projects', populatedProjects));
  } catch (err) { next(err); }
};
export const recommendedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Recommended projects', []));
export const nearbyProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Nearby projects', []));
