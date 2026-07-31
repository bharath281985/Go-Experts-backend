import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const globalSearch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.json(successResponse('Search results', { startups: [], founders: [], industries: [] }));

    const startups = await prisma.user.findMany({
      where: { role: 'founder', status: 'active', OR: [{ fullName: { contains: q } }, { bio: { contains: q } }] },
      include: { founderProfile: true },
      take: 10
    });

    return res.json(successResponse('Search results', { startups, founders: [], industries: [] }));
  } catch (error) { next(error); }
};
