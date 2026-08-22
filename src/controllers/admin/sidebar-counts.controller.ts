import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { getJsonSetting, setJsonSetting } from "../../common/helpers/portal-shared.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

export const getSidebarCounts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const adminReads = await getJsonSetting(userId, "admin-industry-reads", {} as Record<string, string>);

    const [
      messagingUnread,
      supportOpen,
      deleteRequests,
      notifications,
      totalUsers,
      freelancers,
      clients,
      investors,
      founders,
      totalProjects,
      openProjects,
      tasks,
      startupIdeas,
      investments,
      marketing,
      subscriptions,
      payments
    ] = await Promise.all([
      prisma.message.count({ where: { readAt: null } }),
      prisma.supportTicket.count({ where: { status: "open" } }),
      prisma.user.count({ where: { status: "pending_deletion" } }),
      prisma.notification.count({ where: { readAt: null } }),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: "freelancer", deletedAt: null } }),
      prisma.user.count({ where: { role: "client", deletedAt: null } }),
      prisma.user.count({ where: { role: "investor", deletedAt: null } }),
      prisma.user.count({ where: { role: "founder", deletedAt: null } }),
      prisma.project.count({ where: { deletedAt: null } }),
      prisma.project.count({ where: { status: "open", deletedAt: null } }),
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.startupIdea.count({ where: { deletedAt: null } }),
      prisma.investment.count({ where: { deletedAt: null } }),
      prisma.campaign.count({ where: { deletedAt: null } }),
      prisma.subscription.count(),
      prisma.payment.count({ where: { status: "pending" } })
    ]);

    const industriesData = await prisma.industry.findMany({ select: { id: true, name: true } });
    
    // Count unread projects per industry
    const industries = await Promise.all(industriesData.map(async (ind) => {
      const lastRead = adminReads[ind.name];
      const whereClause: any = { industryId: ind.id, deletedAt: null };
      if (lastRead) {
        whereClause.createdAt = { gt: new Date(lastRead) };
      }
      const unreadCount = await prisma.project.count({ where: whereClause });
      return { industry: ind.name, count: unreadCount };
    }));

    res.json({
      success: true,
      counts: {
        messaging: messagingUnread,
        support: supportOpen,
        deleteRequests: deleteRequests,
        notifications: notifications,
        users: {
          total: totalUsers,
          freelancers,
          clients,
          investors,
          founders
        },
        projects: {
          total: totalProjects,
          open: openProjects,
          byIndustry: industries
        },
        tasks,
        startupIdeas,
        investments,
        marketing,
        subscriptions,
        payments
      }
    });

  } catch (err) {
    next(err);
  }
};

export const markSidebarIndustryRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { industry } = req.body;
    if (!industry) {
      return res.status(400).json({ success: false, message: "Industry name is required" });
    }

    const adminReads = await getJsonSetting(userId, "admin-industry-reads", {} as Record<string, string>);
    
    adminReads[industry] = new Date().toISOString();
    await setJsonSetting(userId, "admin-industry-reads", adminReads);

    res.json({ success: true, message: "Industry marked as read" });
  } catch (err) {
    next(err);
  }
};

