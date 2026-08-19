import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    // Founder's startup idea for real data
    const startupIdea = await prisma.startupIdea.findFirst({
      where: { founder: userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const startupIdeaId = startupIdea ? startupIdea.id : 'no-idea-found';

    const [
      founderProfile,
      subscription,
      wallet,
      pendingRequestsCount,
      activeInvestorsCount,
      unreadNotifications,
      upcomingMeetingsCount,
      rawRecommendedInvestors,
      completion,
      rawUpcomingMeetings,
      rawPendingInvestments,
      allInvestments,
      unreadMessages,
      completedMeetings,
      recentFiles,
      pendingDocumentsCount,
    ] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId } }),
      prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        include: { plan: true },
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.investment.count({ where: { startup: startupIdeaId, status: 'Pending' } }),
      prisma.investment.count({ where: { startup: startupIdeaId, status: 'Active' } }),
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
        where: { startup: startupIdeaId, status: 'Pending' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // All investments for this founder's startup for charts
      prisma.investment.findMany({ where: { startup: startupIdeaId } }),
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
      // Completed meetings count (can be used for historic record)
      prisma.meeting.count({ where: { founder: userId, status: 'Completed' } }),
      // Recent Documents
      prisma.mediaFile.findMany({
        where: { uploadedBy: userId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Pending documents
      prisma.mediaFile.count({
        where: { uploadedBy: userId, status: 'pending' },
      })
    ]);

    const recommendedFocusAreaIds = [...new Set(rawRecommendedInvestors.flatMap((user) =>
      String(user.investorProfile?.focusAreas || '').split(',').map((value) => value.trim()).filter(Boolean)
    ))];
    const [focusOptions, focusIndustries] = await Promise.all([
      (prisma as any).masterOption.findMany({
        where: { id: { in: recommendedFocusAreaIds } },
        select: { id: true, label: true },
      }).catch(() => []),
      prisma.industry.findMany({
        where: { id: { in: recommendedFocusAreaIds } },
        select: { id: true, name: true },
      }).catch(() => []),
    ]);
    const focusAreaNameMap = new Map<string, string>([
      ...focusOptions.map((item: any): [string, string] => [item.id, item.label || '']),
      ...focusIndustries.map((item): [string, string] => [item.id, item.name]),
    ]);

    // Format recommendedInvestors with user fields nested inside investorProfile
    // Filter out users who don't have an investor profile yet
    const recommendedInvestors = rawRecommendedInvestors
      .filter(u => u.investorProfile != null)
      .map((u) => {
        return {
          id: u.id,
          // We know investorProfile is non-null because of the filter above
          investorProfile: {
            id: u.investorProfile!.id,
            userId: u.investorProfile!.userId,
            fullName: u.fullName,
            email: u.email,
            avatarUrl: u.avatarUrl,
            city: u.city,
            country: u.country,
            bio: u.bio,
            firm: u.investorProfile!.firm,
            ticketMin: u.investorProfile!.ticketMin,
            ticketMax: u.investorProfile!.ticketMax,
            FocusAreas: String(u.investorProfile!.focusAreas || '')
              .split(',')
              .map((focusAreaId) => focusAreaId.trim())
              .filter(Boolean)
              .map((focusAreaId) => ({
                focusAreaId,
                focusAreaName: focusAreaNameMap.get(focusAreaId) || '',
              })),
            deals: u.investorProfile!.deals,
            createdAt: u.investorProfile!.createdAt,
            updatedAt: u.investorProfile!.updatedAt,
          },
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

    // Recent documents
    const recentDocuments = recentFiles.map(f => ({
      id: f.id,
      name: f.originalName,
      url: f.filepath,
      type: f.filetype,
      size: f.filesize,
      createdAt: f.createdAt,
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

    // --- Compute charts from raw DB data ---
    const fundingProgress = allInvestments.map(inv => ({ date: inv.createdAt, amount: inv.offer, status: inv.status }));
    const investorGrowthArr = allInvestments.map(inv => ({ date: inv.createdAt, count: 1 }));
    const monthlyFundingTrend = allInvestments.map(inv => ({ date: inv.createdAt, amount: inv.offer }));

    // Profile views & pitch deck view trends (mapped straight from db proxy values for raw plotting if needed)
    const startupProfileViews = [{ metric: "pitchDeckViews", value: pitchDeckViews }];

    // Revenue/cash flow/burn rate from wallet transactions
    const walletTransactions = wallet ? await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }) : [];

    const cashFlow = walletTransactions.map(tx => ({
      date: tx.createdAt,
      amount: tx.direction === 'credit' ? tx.amount : -tx.amount,
      type: tx.direction
    }));

    const revenueTrend = walletTransactions.filter(tx => tx.direction === 'credit').map(tx => ({
      date: tx.createdAt,
      amount: tx.amount
    }));

    const burnRate = walletTransactions.filter(tx => tx.direction === 'debit').reduce((sum, tx) => sum + tx.amount, 0);

    const milestoneCompletion = startupCompletion; // use startup completion as milestoneCompletion proxy

    let aiSuggestions = 'Optimize your pitch deck to focus more on your monetization strategy based on similar successful startups.';
    if (startupIdea && fundingRemaining > 0 && fundingRaised === 0) {
      aiSuggestions = 'Your startup idea is fully outlined, but you have not received any funding yet. Consider highlighting your competitive advantage or uploading a clearer business plan to attract early stages investors.';
    } else if (startupCompletion < 50) {
      aiSuggestions = 'Complete your startup profile by adding a pitch deck, business plan, and clear funding goals to improve your visibility to investors.';
    } else if (activeInvestorsCount > 0) {
      aiSuggestions = `You currently have ${activeInvestorsCount} active investors. Keep them updated with regular reports and consider hosting a strategic alignment meeting to secure follow-on funding.`;
    }
    const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { verified: true } });

    return res.json(
      successResponse('Founder dashboard retrieved', {
        profileCompletion: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        accountVerified: Boolean(authUser?.verified),
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
        investorInterests: pendingRequestsCount,
        activeInvestors: activeInvestorsCount,
        pendingMeetings: upcomingMeetingsCount,
        pitchDeckViews,
        profileViews: startupIdea?.views || 0,
        businessPlanCompletion,
        upcomingMilestones: [],
        pendingDocuments: pendingDocumentsCount,
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
          recentDocuments: recentDocuments,
          aiSuggestions: aiSuggestions,
          pendingInvestorRequestsList,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
