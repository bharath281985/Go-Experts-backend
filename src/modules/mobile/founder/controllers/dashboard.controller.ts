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
      startupIdea,
      allInvestments,
      unreadMessages,
      completedMeetings,
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
      // Founder's startup idea for real data
      prisma.startupIdea.findFirst({
        where: { founder: userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }),
      // All investments for this founder's startup for charts
      prisma.investment.findMany({ where: { startup: userId } }),
      // Unread messages
      prisma.message.count({
        where: {
          conversation: {
            OR: [{ userA: userId }, { userB: userId }],
          },
          senderId: { not: userId },
          readAt: null,
        },
      }),
      // Completed meetings count for profile views proxy
      prisma.meeting.count({ where: { founder: userId, status: 'Completed' } }),
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

    // --- Compute real values from startup idea ---
    const fundingGoal = startupIdea?.funding || 0;
    const fundingRaised = allInvestments
      .filter(i => i.status === 'Active')
      .reduce((sum, i) => sum + i.offer, 0);
    const fundingRemaining = Math.max(0, fundingGoal - fundingRaised);
    const pitchDeckViews = startupIdea?.views || 0;
    const startupVerificationStatus = startupIdea?.status || 'pending';

    // Startup completion: check how many fields in startupIdea are filled
    let startupCompletion = 0;
    if (startupIdea) {
      const totalFields = 10;
      let filled = 0;
      if (startupIdea.startup) filled++;
      if (startupIdea.industry) filled++;
      if (startupIdea.category) filled++;
      if (startupIdea.stage) filled++;
      if (startupIdea.funding > 0) filled++;
      if (startupIdea.equity > 0) filled++;
      if (startupIdea.pitchDeck) filled++;
      if (startupIdea.businessPlan) filled++;
      if (startupIdea.logo) filled++;
      if (startupIdea.coverUrl) filled++;
      startupCompletion = Math.round((filled / totalFields) * 100);
    }

    // Business plan completion
    const businessPlanCompletion = startupIdea?.businessPlan ? 100 : 0;

    // --- Compute charts from real investment data ---
    const now = new Date();
    const fundingProgress: number[] = [];
    const investorGrowthArr: number[] = [];
    const monthlyFundingTrend = [0, 0, 0, 0, 0, 0];

    // Sort investments by date for cumulative charts
    const sortedInvestments = [...allInvestments]
      .filter(i => i.status === 'Active')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let cumFunding = 0;
    sortedInvestments.forEach((inv, idx) => {
      cumFunding += inv.offer;
      fundingProgress.push(cumFunding);
      investorGrowthArr.push(idx + 1);
    });
    // Ensure at least one data point
    if (fundingProgress.length === 0) { fundingProgress.push(0); investorGrowthArr.push(0); }

    allInvestments.forEach(inv => {
      const invDate = new Date(inv.createdAt);
      const monthsAgo = (now.getFullYear() - invDate.getFullYear()) * 12 + (now.getMonth() - invDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        monthlyFundingTrend[5 - monthsAgo] += inv.offer;
      }
    });

    // Profile views & pitch deck view trends from startupIdea.views (simplified monthly estimate)
    const startupProfileViews = startupIdea
      ? [
        Math.round(pitchDeckViews * 0.05), Math.round(pitchDeckViews * 0.15),
        Math.round(pitchDeckViews * 0.3), Math.round(pitchDeckViews * 0.55),
        Math.round(pitchDeckViews * 0.8), pitchDeckViews,
      ]
      : [0, 0, 0, 0, 0, 0];

    // Revenue/cash flow/burn rate from wallet transactions if available
    const walletTransactions = wallet ? await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : [];

    const revenueTrend = [0, 0, 0, 0, 0, 0];
    const cashFlow = [0, 0, 0, 0, 0, 0];
    let burnRate = 0;

    walletTransactions.forEach(tx => {
      const txDate = new Date(tx.createdAt);
      const monthsAgo = (now.getFullYear() - txDate.getFullYear()) * 12 + (now.getMonth() - txDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        if (tx.direction === 'credit') {
          revenueTrend[5 - monthsAgo] += tx.amount;
          cashFlow[5 - monthsAgo] += tx.amount;
        } else {
          cashFlow[5 - monthsAgo] -= tx.amount;
          if (monthsAgo === 0) burnRate += tx.amount;
        }
      }
    });

    const milestoneCompletion = startupCompletion; // use startup completion as milestoneCompletion proxy

    return res.json(
      successResponse('Founder dashboard retrieved', {
        profileCompletion: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        startupCompletion,
        startupVerificationStatus,
        subscription: subscription
          ? {
            status: subscription.status,
            planId: subscription.planId,
            planName: subscription.plan.name,
          }
          : null,
        walletBalance: wallet?.balance || 0,
        fundingGoal,
        fundingRaised,
        fundingRemaining,
        investorInterests: pendingRequests,
        activeInvestors: activeInvestorsCount,
        pendingMeetings: upcomingMeetingsCount,
        pitchDeckViews,
        profileViews: completedMeetings, // use completed meetings as a proxy for profile engagement
        businessPlanCompletion,
        upcomingMilestones: [],
        pendingDocuments: 0,
        unreadNotifications,
        unreadMessages,
        charts: {
          fundingProgress,
          investorGrowth: investorGrowthArr,
          startupProfileViews,
          monthlyFundingTrend,
          burnRate,
          cashFlow,
          revenueTrend,
          milestoneCompletion,
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
