import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [totalInvestments, activeInvestments, completedInvestments] = await Promise.all([
      prisma.investment.count({ where: { investor: userId } }),
      prisma.investment.count({ where: { investor: userId, status: 'Active' } }),
      prisma.investment.count({ where: { investor: userId, status: 'Completed' } })
    ]);
    return res.json(successResponse('Analytics retrieved', {
      totalInvestments,
      activeInvestments,
      completedInvestments,
      roi: 0,
      portfolioGrowth: [0, 0, 0, 0, 0, 0],
      industrySplit: [],
      fundingStageSplit: [],
      investmentTrend: [0, 0, 0, 0, 0, 0],
      meetingAnalytics: { total: 0, completed: 0 },
      capitalDeployment: 0
    }));
  } catch (error) { next(error); }
};
