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
      activeContracts,
      unreadNotifications,
      upcomingMeetings,
      totalSpendWallet,
      completion,
      rawUpcomingMeetings,
    ] = await Promise.all([
      prisma.clientProfile.findUnique({ where: { userId } }),
      prisma.project.count({ where: { client: userId, status: 'in_progress' } }),
      prisma.project.count({ where: { client: userId, status: 'draft' } }),
      prisma.project.count({ where: { client: userId, status: 'completed' } }),
      prisma.proposal.count({
        where: { project: { client: userId }, status: 'pending' },
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

    return res.json(
      successResponse('Client dashboard retrieved', {
        profileCompletion: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        activeProjects,
        draftProjects,
        completedProjects,
        pendingProposals,
        shortlistedFreelancers: 0,
        activeContracts,
        pendingPayments: 0,
        monthlySpend: 0,
        totalSpend: clientProfile?.totalSpend || 0,
        unreadMessages: 0,
        unreadNotifications,
        upcomingMeetings,
        supportTickets: 0,
        walletBalance: totalSpendWallet?.balance || 0,
        charts: {
          spendTrend: [0, 0, 0, 0, 0, 0],
          projectStatus: {
            active: activeProjects,
            draft: draftProjects,
            completed: completedProjects,
          },
          proposalFunnel: { pending: pendingProposals, shortlisted: 0, accepted: 0 },
          categoryDistribution: [],
        },
        upcomingMeetingsList,
      })
    );
  } catch (error) {
    next(error);
  }
};
