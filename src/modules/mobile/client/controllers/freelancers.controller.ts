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
    const userId = req.user?.id;
    let savedIds = new Set<string>();
    if (userId) {
      const rows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
      const ids = rows.map((r: any) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean);
      savedIds = new Set(ids);
    }
    
    const mapped = freelancers.map(f => ({
      ...f,
      isSaved: savedIds.has(f.id)
    }));
    
    return res.json(successResponse('Freelancers retrieved', mapped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const freelancer = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'freelancer' },
      include: { freelancerProfile: true, reviewsReceived: { take: 5 } }
    });
    if (!freelancer) {
      return res.status(404).json({ success: false, message: 'Freelancer not found' });
    }
    
    const userId = req.user?.id;
    let isSaved = false;
    if (userId) {
      const rows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
      const ids = rows.map((r: any) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean);
      isSaved = ids.includes(freelancer.id);
    }
    
    return res.json(successResponse('Freelancer details', { ...freelancer, isSaved }));
  } catch (error) { next(error); }
};

export const getRecommendedFreelancers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const freelancers = await prisma.user.findMany({ where: { role: 'freelancer', status: 'active' }, take: 10, include: { freelancerProfile: true } });
    const userId = req.user?.id;
    let savedIds = new Set<string>();
    if (userId) {
      const rows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
      const ids = rows.map((r: any) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean);
      savedIds = new Set(ids);
    }
    
    const mapped = freelancers.map(f => ({
      ...f,
      isSaved: savedIds.has(f.id)
    }));
    
    return res.json(successResponse('Recommended freelancers', mapped));
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
    
    // Extract actual freelancer IDs from whatever format is in the DB
    const freelancerIds = rows.map((r: any) => {
      if (typeof r === 'string') return r;
      return r.freelancerId || r.id;
    }).filter(Boolean);
    
    const freelancers = await prisma.user.findMany({
      where: { id: { in: freelancerIds }, role: 'freelancer', deletedAt: null },
      include: { freelancerProfile: true }
    });
    
    const rowMap = new Map(freelancers.map((f) => [f.id, f]));
    
    // Map to a clean, flat object format expected by the app
    const populated = rows.map((savedItem: any) => {
      const extractedId = typeof savedItem === 'string' ? savedItem : (savedItem.freelancerId || savedItem.id);
      const f = rowMap.get(extractedId);
      
      if (!f) return null; // Drop if user doesn't exist anymore
      
      const profile = f.freelancerProfile;
      const isObject = typeof savedItem === 'object';
      
      return {
        id: (isObject && savedItem.id !== f.id) ? savedItem.id : `sf-${f.id}`,
        freelancerId: f.id,
        slug: f.id, 
        name: f.fullName || (isObject ? savedItem.name : ''),
        headline: profile?.titleHeadline || (isObject ? savedItem.headline : '') || '',
        avatar: f.avatarUrl || (isObject ? savedItem.avatar : '') || '',
        rate: profile?.hourlyRate || (isObject ? savedItem.rate : 0) || 0,
        rating: profile?.rating || (isObject ? savedItem.rating : 0) || 0,
        location: f.city ? `${f.city}, ${f.country || ''}` : (isObject ? savedItem.location : '') || '',
        savedAt: (isObject && savedItem.savedAt) ? savedItem.savedAt : new Date().toISOString(),
      };
    }).filter(Boolean);
    
    return res.json(successResponse('Saved freelancers', populated));
  } catch (error) { next(error); }
};
