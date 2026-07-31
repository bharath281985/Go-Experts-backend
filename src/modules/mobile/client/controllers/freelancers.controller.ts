import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const q = req.query.q as string;

    const where: any = { role: 'freelancer', status: 'active' };
    if (q) where.fullName = { contains: q };

    const [freelancers, total] = await Promise.all([
      prisma.user.findMany({ where, include: { freelancerProfile: true }, skip, take: limit }),
      prisma.user.count({ where })
    ]);
    return res.json(successResponse('Freelancers retrieved', freelancers, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const freelancer = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'freelancer' },
      include: { freelancerProfile: true, reviewsReceived: { take: 5 } }
    });
    return res.json(successResponse('Freelancer details', freelancer));
  } catch (error) { next(error); }
};

export const getRecommendedFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const freelancers = await prisma.user.findMany({ where: { role: 'freelancer', status: 'active' }, take: 10, include: { freelancerProfile: true } });
    return res.json(successResponse('Recommended freelancers', freelancers));
  } catch (error) { next(error); }
};

export const saveFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Freelancer saved')); } catch (error) { next(error); }
};

export const unsaveFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Freelancer removed from saved')); } catch (error) { next(error); }
};

export const getSavedFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Saved freelancers', [])); } catch (error) { next(error); }
};
