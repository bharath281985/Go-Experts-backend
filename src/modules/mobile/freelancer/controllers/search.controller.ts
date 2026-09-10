import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const globalSearch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const [projects, clients] = await Promise.all([
      prisma.project.findMany({ where: { status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] }, title: { contains: q } }, take: 5 }),
      prisma.user.findMany({ where: { role: 'client', status: 'active', fullName: { contains: q } }, take: 5, select: { id: true, fullName: true, avatarUrl: true } })
    ]);
    return res.json(successResponse('Search results', { projects, clients }));
  } catch (error) { next(error); }
};

export const searchProjects = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    const category = req.query.category as string;
    const minBudget = req.query.minBudget ? parseFloat(req.query.minBudget as string) : undefined;
    const maxBudget = req.query.maxBudget ? parseFloat(req.query.maxBudget as string) : undefined;
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

    if (category) where.category = category;
    if (minBudget !== undefined) where.budget = { gte: minBudget };
    if (maxBudget !== undefined) where.budget = { ...where.budget, lte: maxBudget };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.project.count({ where })
    ]);
    return res.json(successResponse('Project search results', projects, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  } catch (error) { next(error); }
};

export const searchClients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) || '';
    const clients = await prisma.user.findMany({
      where: { role: 'client', status: 'active', fullName: { contains: q } },
      select: { id: true, fullName: true, avatarUrl: true, country: true },
      take: 20
    });
    return res.json(successResponse('Client search results', clients));
  } catch (error) { next(error); }
};

export const searchBySkill = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const skill = (req.query.skill as string) || '';
    const projects = await prisma.project.findMany({
      where: { status: 'open', technology: { contains: skill } }, take: 20
    });
    return res.json(successResponse('Skill search results', projects));
  } catch (error) { next(error); }
};
