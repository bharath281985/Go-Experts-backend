import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    const [
      investorProfile,
      subscription,
      wallet,
      totalInvestments,
      activeInvestments,
      closedInvestments,
      pendingInvestments,
      unreadNotifications,
      upcomingMeetings,
      recommendedStartups,
      completion,
    ] = await Promise.all([
      prisma.investorProfile.findUnique({ where: { userId } }),
      prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        include: { plan: true },
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.investment.count({ where: { investor: userId } }),
      prisma.investment.count({ where: { investor: userId, status: 'Active' } }),
      prisma.investment.count({ where: { investor: userId, status: 'Closed' } }),
      prisma.investment.count({ where: { investor: userId, status: 'Pending' } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.meeting.count({ where: { investor: userId, status: 'Scheduled' } }),
      prisma.user.findMany({
        where: { role: 'founder', status: 'active' },
        include: { founderProfile: true },
        take: 5,
      }),
      resolveProfileCompletion(userId),
    ]);

    const activeInvestmentsList = await prisma.investment.findMany({
      where: { investor: userId, status: 'Active' },
    });
    const portfolioValue = activeInvestmentsList.reduce((sum, inv) => sum + inv.offer, 0);

    return res.json(
      successResponse('Investor dashboard retrieved', {
        profileCompletion: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        subscription: subscription
          ? {
              status: subscription.status,
              planId: subscription.planId,
              planName: subscription.plan.name,
            }
          : null,
        walletBalance: wallet?.balance || 0,
        portfolioValue,
        totalInvestments,
        activeInvestments,
        closedInvestments,
        pendingInvestments,
        unreadMessages: 0,
        unreadNotifications,
        upcomingMeetings,
        watchlistCount: 0,
        recommendedStartups,
        trendingStartups: [],
        charts: {
          portfolioGrowth: [0, 0, 0, 0, 0, 0],
          investmentAllocation: [],
          industryDistribution: [],
          fundingStageDistribution: [],
          monthlyInvestments: [0, 0, 0, 0, 0, 0],
          roiTrend: [0, 0, 0, 0, 0, 0],
        },
        recentActivities: [],
        upcomingMeetingsList: [],
      })
    );
  } catch (error) {
    next(error);
  }
};
