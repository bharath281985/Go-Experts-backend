import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    const [
      clientProfile,
      activeProjects,
      draftProjects,
      completedProjects,
      pendingProposals,
      shortlistedProposals,
      activeContracts,
      unreadNotifications,
      upcomingMeetings,
      totalSpendWallet,
      completion,
      rawUpcomingMeetings,
      unreadMessages,
      notifications,
      pendingPayments,
      allPayments,
      supportTicketsCount,
    ] = await Promise.all([
      prisma.clientProfile.findUnique({ where: { userId } }),
      prisma.project.count({ where: { client: userId, status: 'in_progress' } }),
      prisma.project.count({ where: { client: userId, status: 'draft' } }),
      prisma.project.count({ where: { client: userId, status: 'completed' } }),
      prisma.proposal.count({
        where: { project: { client: userId }, status: 'pending' },
      }),
      // Shortlisted freelancers: proposals with "shortlisted" status
      prisma.proposal.count({
        where: { project: { client: userId }, status: 'shortlisted' },
      }),
      prisma.contract.count({ where: { clientId: userId, status: 'active' } }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.meeting.count({
        where: {
          OR: [
            { founder: userId },
            { investor: userId }
          ],
          status: 'Scheduled'
        }
      }),
      prisma.wallet.findUnique({ where: { userId } }),
      resolveProfileCompletion(userId),
      prisma.meeting.findMany({
        where: {
          OR: [
            { founder: userId },
            { investor: userId }
          ],
          status: 'Scheduled'
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
        take: 5,
      }),
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
      // Recent notifications for activities
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Pending payments
      prisma.payment.count({ where: { userId, status: 'pending' } }),
      // All completed payments for spend calculations
      prisma.payment.findMany({ where: { userId, status: 'completed' } }),
      // Support tickets
      prisma.supportTicket.count({ where: { user: userId, status: { not: 'Closed' } } }),
    ]);

    // Populate target details for upcoming meetings
    const targetUserIds = rawUpcomingMeetings.map(m => m.founder === userId ? m.investor : m.founder);
    const meetingTargets = targetUserIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: targetUserIds } }
    }) : [];
    const targetMap = new Map<string, any>();
    meetingTargets.forEach(u => {
      targetMap.set(u.id, {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        city: u.city,
        country: u.country,
        bio: u.bio
      });
    });

    const upcomingMeetingsList = rawUpcomingMeetings.map(m => ({
      ...m,
      targetDetails: targetMap.get(m.founder === userId ? m.investor : m.founder) || null
    }));

    // Compute monthly spend & spend trend from real payments
    const now = new Date();
    const monthlySpend = allPayments
      .filter(p => {
        const d = new Date(p.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((acc, p) => acc + p.amount, 0);

    // Spend trend: Raw mapping from DB
    const spendTrend = allPayments.map(p => ({ date: p.createdAt, amount: p.amount }));

    // Category distribution from user's projects
    const allProjects = await prisma.project.findMany({
      where: { client: userId },
      select: { category: true, status: true },
    });
    const categoryMap = new Map<string, number>();
    allProjects.forEach(p => {
      categoryMap.set(p.category, (categoryMap.get(p.category) || 0) + 1);
    });
    const categoryDistribution = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

    // Accept proposals count
    const acceptedProposals = await prisma.proposal.count({
      where: { project: { client: userId }, status: 'accepted' },
    });

    const recentActivities = (notifications || []).map(n => ({
      id: n.id,
      title: n.title,
      content: n.message,
      createdAt: n.createdAt,
    }));

    const authUser = await prisma.user.findUnique({ where: { id: userId }, select: { verified: true } });

    return res.json(
      successResponse('Client dashboard retrieved', {
        profileCompletion: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        accountVerified: Boolean(authUser?.verified),
        activeProjects,
        draftProjects,
        completedProjects,
        pendingProposals,
        shortlistedFreelancers: shortlistedProposals,
        activeContracts,
        pendingPayments,
        monthlySpend,
        totalSpend: clientProfile?.totalSpend || 0,
        unreadMessages,
        unreadNotifications,
        upcomingMeetings,
        supportTickets: supportTicketsCount,
        walletBalance: totalSpendWallet?.balance || 0,
        charts: {
          spendTrend,
          projectStatus: {
            active: activeProjects,
            draft: draftProjects,
            completed: completedProjects,
          },
          proposalFunnel: { pending: pendingProposals, shortlisted: shortlistedProposals, accepted: acceptedProposals },
          categoryDistribution,
        },
        upcomingMeetingsList,
        recentActivities,
      })
    );
  } catch (error) {
    next(error);
  }
};
