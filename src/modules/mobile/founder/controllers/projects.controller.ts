import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { shapeProject, shapeProjects } from '../../../../services/mobile/project-shape.service.js';

export const listProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const skip = (page - 1) * limit;
    const q = ((req.query.q as string) || '').trim();

    const where: any = {
      deletedAt: null,
      freelancer: req.user.id,
    };

    if (q) {
      where.AND = [{ OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
        { technology: { contains: q } },
        { workMode: { contains: q } },
        { experienceLevel: { contains: q } },
      ] }];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.project.count({ where })
    ]);
    const mapped = await shapeProjects(projects, req.user?.id);
    return res.json(successResponse('Projects retrieved', mapped, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  } catch (error) { next(error); }
};

export const getProjectDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const project = await prisma.project.findFirst({ where: { id: req.params.id, deletedAt: null }, include: { milestones: true, tasks: true } });
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
export const savedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Saved projects', []));
export const recommendedProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Recommended projects', []));
export const nearbyProjects = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Nearby projects', []));
