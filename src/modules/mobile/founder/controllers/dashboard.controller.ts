import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [
      founderProfile,
      subscription,
      wallet,
      pendingRequests,
      activeInvestors,
      unreadNotifications,
      upcomingMeetings,
      recommendedInvestors,
      completion,
    ] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId } }),
      prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        include: { plan: true },
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.investment.count({ where: { startup: userId, status: 'Pending' } }),
      prisma.investment.count({ where: { startup: userId, status: 'Active' } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.meeting.count({ where: { founder: userId, status: 'Scheduled' } }),
      prisma.user.findMany({
        where: { role: 'investor', status: 'active' },
        include: { investorProfile: true },
        take: 5,
      }),
      resolveProfileCompletion(userId),
    ]);

    return res.json(
      successResponse('Founder dashboard retrieved', {
        profileCompletion: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        startupCompletion: founderProfile ? 75 : 10,
        startupVerificationStatus: 'verified',
        subscription: subscription
          ? {
              status: subscription.status,
              planId: subscription.planId,
              planName: subscription.plan.name,
            }
          : null,
        walletBalance: wallet?.balance || 0,
        fundingGoal: 500000,
        fundingRaised: founderProfile?.raised || 0,
        fundingRemaining: 500000 - (founderProfile?.raised || 0),
        investorInterests: pendingRequests,
        activeInvestors,
        pendingMeetings: upcomingMeetings,
        pitchDeckViews: 120,
        profileViews: 450,
        businessPlanCompletion: 100,
        upcomingMilestones: [],
        pendingDocuments: 0,
        unreadNotifications,
        unreadMessages: 0,
        charts: {
          fundingProgress: [0, 10000, 50000, 150000, 200000],
          investorGrowth: [1, 2, 4, 8, 12],
          startupProfileViews: [10, 50, 100, 300, 450],
          monthlyFundingTrend: [0, 0, 50000, 100000, 50000, 0],
          burnRate: 15000,
          cashFlow: [10000, -5000, 2000, -1000, -15000],
          revenueTrend: [0, 1000, 2000, 5000, 8000],
          milestoneCompletion: 60,
        },
        widgets: {
          recommendedInvestors,
          upcomingMeetingsList: [],
          recentActivities: [],
          recentDocuments: [],
          aiSuggestions:
            'Optimize your pitch deck to focus more on your monetization strategy based on similar successful startups.',
          pendingInvestorRequestsList: [],
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
