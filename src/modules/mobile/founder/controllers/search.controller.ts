import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const globalSearch = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.json(successResponse('Search results', { investors: [], startups: [], industries: [] }));

    const investors = await prisma.user.findMany({
      where: { role: 'investor', status: 'active', OR: [{ fullName: { contains: q } }, { bio: { contains: q } }] },
      include: { investorProfile: true },
      take: 10
    });

    return res.json(successResponse('Search results', { investors, startups: [], industries: [] }));
  } catch (error) { next(error); }
};
