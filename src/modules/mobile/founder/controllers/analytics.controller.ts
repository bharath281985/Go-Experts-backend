import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [founderProfile, activeInvestors] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId } }),
      prisma.investment.count({ where: { startup: userId, status: 'Active' } })
    ]);
    return res.json(successResponse('Analytics retrieved', {
      fundingAnalytics: { goal: 500000, raised: founderProfile?.raised || 0 },
      investorAnalytics: { active: activeInvestors, pending: 0 },
      pitchViews: 120,
      revenueTrend: [0, 1000, 2000, 5000, 8000],
      burnRate: 15000,
      cashFlow: [10000, -5000, 2000, -1000, -15000],
      mrr: 8000,
      arr: 96000,
      startupGrowth: 45
    }));
  } catch (error) { next(error); }
};
