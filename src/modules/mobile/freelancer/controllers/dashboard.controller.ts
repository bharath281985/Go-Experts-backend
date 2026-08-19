import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';
import { getVerificationStats } from '../../../../common/helpers/verification.js';

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    const [
      profile, wallet, subscription, todayTasksCount,
      upcomingMeetings, unreadNotifications, pendingProposals,
      acceptedProjects, completedProjects, currentContracts,
      reviews, rawUpcomingMeetings, completion,
      unreadMessages, notifications, allPayments, allProposals,
    ] = await Promise.all([
      prisma.freelancerProfile.findUnique({ where: { userId } }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.subscription.findFirst({ where: { userId, status: 'active' } }),
      prisma.task.count({ where: { assignedTo: userId, status: { not: 'done' }, dueDate: new Date().toISOString().split('T')[0] } }),
      prisma.meeting.count({
        where: {
          OR: [
            { founder: userId },
            { investor: userId }
          ],
          status: 'Scheduled'
        }
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.proposal.count({ where: { freelancerId: userId, status: 'pending' } }),
      prisma.project.count({ where: { freelancer: userId, status: 'in_progress' } }),
      prisma.project.count({ where: { freelancer: userId, status: 'completed' } }),
      prisma.contract.count({ where: { freelancerId: userId, status: 'active' } }),
      prisma.review.findMany({ where: { revieweeId: userId } }),
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
      // Profile completion from service
      resolveProfileCompletion(userId),
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
      // All payments for earnings computation
      prisma.payment.findMany({ where: { userId, status: 'completed' } }),
      // All proposals for chart
      prisma.proposal.findMany({ where: { freelancerId: userId } }),
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

    // Compute earnings from payments
    const lifetimeEarnings = allPayments.reduce((acc, p) => acc + p.amount, 0);
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyEarnings = allPayments
      .filter(p => {
        const d = new Date(p.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((acc, p) => acc + p.amount, 0);

    const avgRating = reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 5.0;

    // Resolve topSkills UUIDs to names
    let topSkills: string[] = [];
    if (profile?.skills) {
      const skillIds = profile.skills.split(',').map(s => s.trim()).filter(Boolean);
      if (skillIds.length > 0) {
        const skillsDb = await prisma.skill.findMany({
          where: { id: { in: skillIds } },
          select: { name: true }
        });
        topSkills = skillsDb.map(s => s.name);
      }
    }

    // --- Compute charts from raw DB data ---
    const earningsChart = allPayments.map(p => ({ date: p.createdAt, amount: p.amount }));

    // Projects chart: count projects completed per month
    const allCompletedProjects = await prisma.project.findMany({
      where: { freelancer: userId, status: 'completed' },
      select: { updatedAt: true },
    });
    const projectsChart = allCompletedProjects.map(p => ({ date: p.updatedAt, count: 1 }));

    // Proposals chart: proposals submitted per month
    const proposalsChart = allProposals.map(p => ({ date: p.createdAt, count: 1 }));

    // Monthly activity: sum of projects + proposals + payments per month (Raw representation mapping the available arrays if possible, but we will return raw actions now)
    const monthlyActivity = {
      earnings: earningsChart,
      projects: projectsChart,
      proposals: proposalsChart
    };

    const recentActivities = (notifications || []).map(n => ({
      id: n.id,
      title: n.title,
      content: n.message,
      createdAt: n.createdAt,
    }));

    const authUser = await prisma.user.findUnique({ where: { id: userId } });
    const verStats = authUser ? getVerificationStats(authUser) : { missingCount: 0, trustScore: 0 };

    const data = {
      profileCompletion: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
      accountVerified: Boolean(authUser?.verified),
      verificationMissingCount: verStats.missingCount,
      verificationTrustScore: verStats.trustScore,
      walletBalance: wallet?.balance || 0,
      subscriptionStatus: subscription ? 'active' : 'inactive',
      todaysTasks: todayTasksCount,
      upcomingMeetings,
      unreadNotifications,
      unreadMessages,
      pendingProposals,
      acceptedProjects,
      completedProjects,
      currentContracts,
      monthlyEarnings,
      lifetimeEarnings,
      averageRating: avgRating,
      reviewCount: reviews.length,
      topSkills,
      projectStatistics: { total: acceptedProjects + completedProjects, completed: completedProjects },
      charts: {
        earnings: earningsChart,
        projects: projectsChart,
        proposals: proposalsChart,
        monthlyActivity,
      },
      upcomingMeetingsList,
      recentActivities,
    };

    return res.json(successResponse('Freelancer dashboard retrieved', data));
  } catch (error) { next(error); }
};
