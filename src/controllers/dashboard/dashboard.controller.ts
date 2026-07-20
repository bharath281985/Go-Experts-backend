import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      users,
      freelancers,
      clients,
      investors,
      founders,
      projects,
      tasks,
      payments,
      subscriptions,
      support_tickets,
      startup_ideas,
      investments,
      marketing_campaigns,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "freelancer" } }),
      prisma.user.count({ where: { role: "client" } }),
      prisma.user.count({ where: { role: "investor" } }),
      prisma.user.count({ where: { role: "founder" } }),
      prisma.project.count(),
      prisma.task.count(),
      prisma.payment.count(),
      prisma.subscription.count(),
      prisma.supportTicket.count(),
      prisma.startupIdea.count(),
      prisma.investment.count(),
      prisma.campaign.count(),
    ]);

    // Calculate revenue from completed payments
    const paymentsList = await prisma.payment.findMany({
      where: { status: "completed" },
      select: { amount: true },
    });
    const revenue = paymentsList.reduce((acc, p) => acc + Number(p.amount), 0);

    res.json({
      success: true,
      stats: {
        users,
        freelancers,
        clients,
        investors,
        founders,
        projects,
        tasks,
        payments,
        subscriptions,
        support_tickets,
        startup_ideas,
        investments,
        marketing_campaigns,
        revenue,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getDashboardCharts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Return sample or aggregated database chart counts
    res.json({
      success: true,
      data: {
        revenueTrend: [
          { month: "Jan", revenue: 120000 },
          { month: "Feb", revenue: 150000 },
          { month: "Mar", revenue: 180000 },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getRecentActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { fullName: true } } },
    });
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
};
