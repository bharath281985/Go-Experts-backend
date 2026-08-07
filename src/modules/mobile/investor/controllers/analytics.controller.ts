import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [totalInvestments, activeInvestments, completedInvestments, allInvestments, meetingsTotal, meetingsCompleted] = await Promise.all([
      prisma.investment.count({ where: { investor: userId } }),
      prisma.investment.count({ where: { investor: userId, status: 'Active' } }),
      prisma.investment.count({ where: { investor: userId, status: 'Completed' } }),
      prisma.investment.findMany({ where: { investor: userId } }),
      prisma.meeting.count({ where: { investor: userId } }),
      prisma.meeting.count({ where: { investor: userId, status: 'Completed' } }),
    ]);

    // Capital deployment = sum of all investment offers
    const capitalDeployment = allInvestments.reduce((sum, inv) => sum + inv.offer, 0);
    const activeCapital = allInvestments.filter(i => i.status === 'Active').reduce((sum, inv) => sum + inv.offer, 0);

    // Portfolio growth: monthly cumulative investment amounts (last 6 months)
    const now = new Date();
    const portfolioGrowth = [0, 0, 0, 0, 0, 0];
    const investmentTrend = [0, 0, 0, 0, 0, 0];

    allInvestments.forEach(inv => {
      const invDate = new Date(inv.createdAt);
      const monthsAgo = (now.getFullYear() - invDate.getFullYear()) * 12 + (now.getMonth() - invDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        portfolioGrowth[5 - monthsAgo] += inv.offer;
        investmentTrend[5 - monthsAgo] += 1;
      }
    });
    // Make cumulative
    for (let i = 1; i < 6; i++) {
      portfolioGrowth[i] += portfolioGrowth[i - 1];
    }

    // Industry & funding stage splits from invested startups
    const startupUserIds = Array.from(new Set(allInvestments.map(i => i.startup)));
    const investedStartups = startupUserIds.length > 0 ? await prisma.startupIdea.findMany({
      where: { founder: { in: startupUserIds } },
    }) : [];
    const industryMap = new Map<string, number>();
    const stageMap = new Map<string, number>();
    const startupByFounder = new Map<string, any>();
    investedStartups.forEach(s => startupByFounder.set(s.founder, s));

    allInvestments.forEach(inv => {
      const startup = startupByFounder.get(inv.startup);
      if (startup) {
        industryMap.set(startup.industry, (industryMap.get(startup.industry) || 0) + inv.offer);
        stageMap.set(startup.stage, (stageMap.get(startup.stage) || 0) + inv.offer);
      }
    });

    const industrySplit = Array.from(industryMap.entries()).map(([industry, amount]) => ({ industry, amount }));
    const fundingStageSplit = Array.from(stageMap.entries()).map(([stage, amount]) => ({ stage, amount }));

    // ROI: simplified as (activeCapital / capitalDeployment - 1) * 100
    const roi = capitalDeployment > 0 ? Math.round(((activeCapital - capitalDeployment) / capitalDeployment) * 100) : 0;

    return res.json(successResponse('Analytics retrieved', {
      totalInvestments,
      activeInvestments,
      completedInvestments,
      roi,
      portfolioGrowth,
      industrySplit,
      fundingStageSplit,
      investmentTrend,
      meetingAnalytics: { total: meetingsTotal, completed: meetingsCompleted },
      capitalDeployment,
    }));
  } catch (error) { next(error); }
};
