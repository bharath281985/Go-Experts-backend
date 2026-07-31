import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    
    const [
      profile, wallet, subscription, todayTasksCount, 
      upcomingMeetings, unreadNotifications, pendingProposals,
      acceptedProjects, completedProjects, currentContracts,
      reviews, rawUpcomingMeetings
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

    let lifetimeEarnings = 0;
    const avgRating = reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : 5.0;

    const data = {
      profileCompletion: profile ? 80 : 0,
      walletBalance: wallet?.balance || 0,
      subscriptionStatus: subscription ? 'active' : 'inactive',
      todaysTasks: todayTasksCount,
      upcomingMeetings,
      unreadNotifications,
      unreadMessages: 0, 
      pendingProposals,
      acceptedProjects,
      completedProjects,
      currentContracts,
      monthlyEarnings: 0,
      lifetimeEarnings,
      averageRating: avgRating,
      reviewCount: reviews.length,
      topSkills: profile?.skills ? profile.skills.split(',') : [],
      projectStatistics: { total: acceptedProjects + completedProjects, completed: completedProjects },
      charts: {
        earnings: [0, 0, 0, 0, 0, 0],
        projects: [0, 0, 0, 0, 0, 0],
        proposals: [0, 0, 0, 0, 0, 0],
        monthlyActivity: [0, 0, 0, 0, 0, 0]
      },
      upcomingMeetingsList,
    };

    return res.json(successResponse('Freelancer dashboard retrieved', data));
  } catch (error) { next(error); }
};
