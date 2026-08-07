import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [founderProfile, activeInvestors, pendingInvestors, startupIdea, allInvestments, wallet] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId } }),
      prisma.investment.count({ where: { startup: userId, status: 'Active' } }),
      prisma.investment.count({ where: { startup: userId, status: 'Pending' } }),
      prisma.startupIdea.findFirst({ where: { founder: userId, status: 'active' }, orderBy: { createdAt: 'desc' } }),
      prisma.investment.findMany({ where: { startup: userId } }),
      prisma.wallet.findUnique({ where: { userId } }),
    ]);

    // Funding analytics from real data
    const fundingGoal = startupIdea?.funding || 0;
    const fundingRaised = allInvestments
      .filter(i => i.status === 'Active')
      .reduce((sum, i) => sum + i.offer, 0);

    // Pitch views from startup idea
    const pitchViews = startupIdea?.views || 0;

    // Revenue trend, burn rate, cash flow from wallet transactions
    const walletId = wallet?.id;
    const walletTransactions = walletId ? await prisma.walletTransaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : [];

    const now = new Date();
    const revenueTrend = [0, 0, 0, 0, 0];
    const cashFlow = [0, 0, 0, 0, 0];
    let burnRate = 0;

    walletTransactions.forEach(tx => {
      const txDate = new Date(tx.createdAt);
      const monthsAgo = (now.getFullYear() - txDate.getFullYear()) * 12 + (now.getMonth() - txDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 5) {
        if (tx.direction === 'credit') {
          revenueTrend[4 - monthsAgo] += tx.amount;
          cashFlow[4 - monthsAgo] += tx.amount;
        } else {
          cashFlow[4 - monthsAgo] -= tx.amount;
          if (monthsAgo === 0) burnRate += tx.amount;
        }
      }
    });

    // MRR from current month credits, ARR extrapolated
    const mrr = revenueTrend[4] || 0; // latest month revenue
    const arr = mrr * 12;

    // Startup growth: investor count growth over total
    const totalInvestors = activeInvestors + pendingInvestors;
    const startupGrowth = totalInvestors > 0 ? Math.round((activeInvestors / totalInvestors) * 100) : 0;

    return res.json(successResponse('Analytics retrieved', {
      fundingAnalytics: { goal: fundingGoal, raised: fundingRaised },
      investorAnalytics: { active: activeInvestors, pending: pendingInvestors },
      pitchViews,
      revenueTrend,
      burnRate,
      cashFlow,
      mrr,
      arr,
      startupGrowth,
    }));
  } catch (error) { next(error); }
};
