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
      prisma.meeting.count({ where: { founder: userId, status: 'Scheduled' } }),
      prisma.wallet.findUnique({ where: { userId } }),
      resolveProfileCompletion(userId),
    ]);

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
      })
    );
  } catch (error) {
    next(error);
  }
};
