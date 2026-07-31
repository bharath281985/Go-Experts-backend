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
      upcomingMeetingsCount,
      ideas,
      completion,
      rawUpcomingMeetings,
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

    const recommendedStartups = ideas.map(idea => {
      const founderInfo = founderMap.get(idea.founder) || null;
      return {
        id: idea.id,
        startup: idea.startup,
        industry: idea.industry,
        category: idea.category,
        stage: idea.stage,
        funding: idea.funding,
        equity: idea.equity,
        visibility: idea.visibility,
        pitchDeck: idea.pitchDeck,
        businessPlan: idea.businessPlan,
        logo: idea.logo,
        coverUrl: idea.coverUrl,
        status: idea.status,
        views: idea.views,
        interestedInvestors: idea.interestedInvestors,
        createdAt: idea.createdAt,
        updatedAt: idea.updatedAt,
        deletedAt: idea.deletedAt,
        founderId: idea.founder,
        founder: founderInfo,
      };
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
        upcomingMeetings: upcomingMeetingsCount,
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
        recentActivities,
        upcomingMeetingsList,
      })
    );
  } catch (error) {
    next(error);
  }
};
