import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';
import { getVerificationStats } from '../../../../common/helpers/verification.js';
import { loadRelatedDataForIdeas, formatStartupResponse, readList } from './startups.controller.js';

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
      upcomingMeetingsCount,
      ideas,
      completion,
      rawUpcomingMeetings,
      unreadMessages,
      trendingStartups,
      allInvestments,
      supportTicketsCount,
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
      prisma.startupIdea.findMany({
        where: { status: 'active', visibility: 'Public' },
        take: 5,
      }),
      resolveProfileCompletion(userId),
      prisma.meeting.findMany({
        where: { investor: userId, status: 'Scheduled' },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        take: 5,
      }),
      // Unread messages: count messages in conversations where user is a participant and messages are unread
      prisma.message.count({
        where: {
          conversation: {
            OR: [{ userA: userId }, { userB: userId }],
          },
          senderId: { not: userId },
          readAt: null,
        },
      }),
      // Trending startups by views
      prisma.startupIdea.findMany({
        where: { status: 'active', visibility: 'Public' },
        orderBy: { views: 'desc' },
        take: 5,
      }),
      // All investments for chart computation
      prisma.investment.findMany({
        where: { investor: userId },
      }),
      // Support tickets count
      prisma.supportTicket.count({ where: { requesterId: userId, status: { not: 'RESOLVED' } } }),
    ]);

    // Populate founder info for recommended startups
    const founderIds = Array.from(new Set(ideas.map(idea => idea.founder).filter(Boolean))) as string[];
    const founders = founderIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: founderIds }, role: 'founder' },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        city: true,
        country: true,
        bio: true,
        createdAt: true,
        founderProfile: {
          select: {
            id: true,
            startupName: true,
            industry: true,
            stage: true,
            raised: true,
            teamSize: true,
          },
        },
      },
    }) : [];

    const founderMap = new Map<string, any>();
    founders.forEach(f => {
      founderMap.set(f.id, {
        id: f.id,
        fullName: f.fullName,
        email: f.email,
        avatarUrl: f.avatarUrl,
        city: f.city,
        country: f.country,
        bio: f.bio,
        createdAt: f.createdAt,
        profileId: f.founderProfile?.id ?? null,
        startupName: f.founderProfile?.startupName ?? null,
        industry: f.founderProfile?.industry ?? null,
        stage: f.founderProfile?.stage ?? null,
        raised: f.founderProfile?.raised ?? null,
        teamSize: f.founderProfile?.teamSize ?? null,
      });
    });

    // Get startup details for industry/stage distribution early to resolve industry/stage names
    const startupUserIds = Array.from(new Set(allInvestments.map(i => i.startup)));
    const investedStartups = startupUserIds.length > 0 ? await prisma.startupIdea.findMany({
      where: { id: { in: startupUserIds } },
    }) : [];

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas([...ideas, ...trendingStartups, ...investedStartups]);
    const watchlist = await readList(userId);
    const savedIds = new Set<string>(watchlist.map((w: any) => w.startupId));
    const investedIds = new Set<string>(allInvestments.map(i => i.startup));

    const recommendedStartups = ideas.map(idea => {
      return formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap);
    });

    const trendingStartupsList = trendingStartups.map(idea => {
      return formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap);
    });

    // Populate founder details for meetings
    const founderIdsForMeetings = rawUpcomingMeetings.map(m => m.founder);
    const meetingFounders = founderIdsForMeetings.length > 0 ? await prisma.user.findMany({
      where: { id: { in: founderIdsForMeetings } },
      include: { founderProfile: true }
    }) : [];
    const meetingFounderMap = new Map<string, any>();
    meetingFounders.forEach(u => {
      meetingFounderMap.set(u.id, {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        city: u.city,
        country: u.country,
        bio: u.bio,
        founderProfile: u.founderProfile
      });
    });

    const upcomingMeetingsList = rawUpcomingMeetings.map(m => ({
      ...m,
      founderDetails: meetingFounderMap.get(m.founder) || null
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

    // Portfolio value from active investments
    const activeInvestmentsList = allInvestments.filter(inv => inv.status === 'Active');
    const portfolioValue = activeInvestmentsList.reduce((sum, inv) => sum + inv.offer, 0);

    // --- Compute charts from raw DB data ---
    const industryDistributionMap = new Map<string, number>();
    const stageMap = new Map<string, number>();

    // Startup details for industry/stage distribution are now fetched earlier
    const startupByFounder = new Map<string, any>();
    investedStartups.forEach(s => startupByFounder.set(s.id, s));

    allInvestments.forEach(inv => {
      // Industry & stage distribution
      const startup = startupByFounder.get(inv.startup);
      if (startup) {
        const industryIsUuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(startup.industry || ''));
        const stageIsUuid = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(String(startup.stage || ''));
        const resolvedIndustry = industryMap.get(startup.industry) || (industryIsUuid ? '' : startup.industry);
        const resolvedStage = optionMap.get(startup.stage) || (stageIsUuid ? '' : startup.stage);
        if (resolvedIndustry) {
          industryDistributionMap.set(resolvedIndustry, (industryDistributionMap.get(resolvedIndustry) || 0) + inv.offer);
        }
        if (resolvedStage) {
          stageMap.set(resolvedStage, (stageMap.get(resolvedStage) || 0) + inv.offer);
        }
      }
    });

    const investmentAllocation = allInvestments
      .filter(i => i.status === 'Active')
      .map(i => ({
        startup: startupByFounder.get(i.startup)?.startup || 'Unknown',
        amount: i.offer,
      }));

    const industryDistribution = Array.from(industryDistributionMap.entries()).map(([industry, amount]) => ({ industry, amount }));
    const fundingStageDistribution = Array.from(stageMap.entries()).map(([stage, amount]) => ({ stage, amount }));

    // Raw mapping rather than bucketing
    const portfolioGrowth = allInvestments.map(inv => ({ date: inv.createdAt, amount: inv.offer, status: inv.status }));
    const monthlyInvestments = allInvestments.map(inv => ({ date: inv.createdAt, count: 1 }));
    const roiTrend = allInvestments.map(inv => ({ date: inv.createdAt, amount: inv.offer }));

    const watchlistCount = watchlist.length;

    const authUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { investorProfile: true },
    });
    const verStats = authUser ? getVerificationStats(authUser) : { missingCount: 0, trustScore: 0 };

    return res.json(
      successResponse('Investor dashboard retrieved', {
        profileCompletion: completion.profileCompletion,
        profileCompletedPer: completion.profileCompletion,
        profileCompletedPercentage: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        accountVerified: Boolean(authUser?.verified),
        verificationMissingCount: verStats.missingCount,
        verificationTrustScore: verStats.trustScore,
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
        unreadMessages,
        unreadNotifications,
        upcomingMeetings: upcomingMeetingsCount,
        watchlistCount,
        supportTickets: supportTicketsCount,
        charts: {
          portfolioGrowth,
          investmentAllocation,
          industryDistribution,
          fundingStageDistribution,
          monthlyInvestments,
          roiTrend,
        },
        widgets: {
          recommendedStartups,
          trendingStartups: trendingStartupsList,
          recentActivities,
          upcomingMeetingsList,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
