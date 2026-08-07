import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { resolveProfileCompletion } from '../../../../services/mobile/profile-completion.service.js';

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;

    const [
      profile, wallet, subscription, todayTasksCount,
      upcomingMeetings, unreadNotifications, pendingProposals,
      acceptedProjects, completedProjects, currentContracts,
      reviews, rawUpcomingMeetings, completion,
      unreadMessages, allPayments, allProposals,
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

    // --- Compute charts from real data ---
    const earningsChart = [0, 0, 0, 0, 0, 0];
    allPayments.forEach(p => {
      const pDate = new Date(p.createdAt);
      const monthsAgo = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        earningsChart[5 - monthsAgo] += p.amount;
      }
    });

    // Projects chart: count projects completed per month
    const allCompletedProjects = await prisma.project.findMany({
      where: { freelancer: userId, status: 'completed' },
      select: { updatedAt: true },
    });
    const projectsChart = [0, 0, 0, 0, 0, 0];
    allCompletedProjects.forEach(p => {
      const pDate = new Date(p.updatedAt);
      const monthsAgo = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        projectsChart[5 - monthsAgo] += 1;
      }
    });

    // Proposals chart: proposals submitted per month
    const proposalsChart = [0, 0, 0, 0, 0, 0];
    allProposals.forEach(p => {
      const pDate = new Date(p.createdAt);
      const monthsAgo = (now.getFullYear() - pDate.getFullYear()) * 12 + (now.getMonth() - pDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        proposalsChart[5 - monthsAgo] += 1;
      }
    });

    // Monthly activity: sum of projects + proposals + payments per month
    const monthlyActivity = earningsChart.map((e, i) => projectsChart[i] + proposalsChart[i] + (e > 0 ? 1 : 0));

    const data = {
      profileCompletion: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
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
    };

    return res.json(successResponse('Freelancer dashboard retrieved', data));
  } catch (error) { next(error); }
};
