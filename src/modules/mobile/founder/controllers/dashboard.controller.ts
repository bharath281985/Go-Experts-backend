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
      activeInvestorsCount,
      unreadNotifications,
      upcomingMeetingsCount,
      rawRecommendedInvestors,
      completion,
      rawUpcomingMeetings,
      rawPendingInvestments,
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
      prisma.meeting.findMany({
        where: { founder: userId, status: 'Scheduled' },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        take: 5,
      }),
      prisma.investment.findMany({
        where: { startup: userId, status: 'Pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Format recommendedInvestors with user fields nested inside investorProfile
    const recommendedInvestors = rawRecommendedInvestors.map((u) => {
      return {
        id: u.id,
        investorProfile: u.investorProfile ? {
          id: u.investorProfile.id,
          userId: u.investorProfile.userId,
          fullName: u.fullName,
          email: u.email,
          avatarUrl: u.avatarUrl,
          city: u.city,
          country: u.country,
          bio: u.bio,
          firm: u.investorProfile.firm,
          ticketMin: u.investorProfile.ticketMin,
          ticketMax: u.investorProfile.ticketMax,
          focusAreas: u.investorProfile.focusAreas,
          deals: u.investorProfile.deals,
          createdAt: u.investorProfile.createdAt,
          updatedAt: u.investorProfile.updatedAt,
        } : null,
      };
    });

    // Populate investor details for upcoming meetings
    const investorIdsForMeetings = rawUpcomingMeetings.map(m => m.investor);
    const meetingInvestors = investorIdsForMeetings.length > 0 ? await prisma.user.findMany({
      where: { id: { in: investorIdsForMeetings } },
      include: { investorProfile: true }
    }) : [];
    const investorMap = new Map<string, any>();
    meetingInvestors.forEach(u => {
      investorMap.set(u.id, {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        city: u.city,
        country: u.country,
        bio: u.bio,
        investorProfile: u.investorProfile
      });
    });

    const upcomingMeetingsList = rawUpcomingMeetings.map(m => ({
      ...m,
      investorDetails: investorMap.get(m.investor) || null
    }));

    // Populate investor details for pending requests
    const investorIdsForInvestments = rawPendingInvestments.map(i => i.investor);
    const investmentInvestors = investorIdsForInvestments.length > 0 ? await prisma.user.findMany({
      where: { id: { in: investorIdsForInvestments } },
      include: { investorProfile: true }
    }) : [];
    const investmentInvestorMap = new Map<string, any>();
    investmentInvestors.forEach(u => {
      investmentInvestorMap.set(u.id, {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        city: u.city,
        country: u.country,
        bio: u.bio,
        investorProfile: u.investorProfile
      });
    });

    const pendingInvestorRequestsList = rawPendingInvestments.map(inv => ({
      ...inv,
      investorDetails: investmentInvestorMap.get(inv.investor) || null
    }));

    // Recent notifications as activities
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    const recentActivities = notifications.map(n => ({
      id: n.id,
      title: n.title,
      content: n.message,
      createdAt: n.createdAt,
    }));

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
        activeInvestors: activeInvestorsCount,
        pendingMeetings: upcomingMeetingsCount,
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
          upcomingMeetingsList,
          recentActivities,
          recentDocuments: [],
          aiSuggestions:
            'Optimize your pitch deck to focus more on your monetization strategy based on similar successful startups.',
          pendingInvestorRequestsList,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
