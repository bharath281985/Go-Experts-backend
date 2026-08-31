import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';

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
  try {
    const userId = req.user.id;
    const freelancerId = req.params.id;

    const rows: any[] = await getJsonSetting(userId, 'savedFreelancers', []);
    const existing = rows.findIndex((r: any) => r.freelancerId === freelancerId);

    let saved = true;
    let nextRows = rows;
    if (existing >= 0) {
      saved = true;
    } else {
      const entry = {
        id: `sf-${Date.now()}`,
        freelancerId,
        slug: freelancerId,
        name: 'Freelancer',
        headline: '',
        avatar: '',
        rate: 0,
        rating: 5,
        location: '',
        savedAt: new Date().toISOString(),
      };
      nextRows = [...rows, entry];
      await setJsonSetting(userId, 'savedFreelancers', nextRows);
    }

    return res.json(successResponse('Freelancer saved', { saved, rows: nextRows }));
  } catch (error) { next(error); }
};

export const unsaveFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const freelancerId = req.params.id;

    const rows: any[] = await getJsonSetting(userId, 'savedFreelancers', []);
    const nextRows = rows.filter((r: any) => r.id !== freelancerId && r.freelancerId !== freelancerId);
    
    await setJsonSetting(userId, 'savedFreelancers', nextRows);
    return res.json(successResponse('Freelancer removed from saved', { rows: nextRows }));
  } catch (error) { next(error); }
};

export const getSavedFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const rows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
    
    if (rows.length === 0) {
      return res.json(successResponse('Saved freelancers', []));
    }
    
    const freelancerIds = rows.map((r: any) => r.freelancerId).filter(Boolean);
    const freelancers = await prisma.user.findMany({
      where: { id: { in: freelancerIds }, role: 'freelancer', deletedAt: null },
      include: { freelancerProfile: true }
    });
    
    // Maintain the order and mapping, or just return the full details directly
    const rowMap = new Map(freelancers.map((f) => [f.id, f]));
    const populated = freelancerIds.map((id: string) => rowMap.get(id)).filter(Boolean);
    
    return res.json(successResponse('Saved freelancers', populated));
  } catch (error) { next(error); }
};
