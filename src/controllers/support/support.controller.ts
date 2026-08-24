import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

// User creates a report
export const createReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { reportedUserId, conversationId, messageId, reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: "Reason is required" });

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        reportedUserId,
        conversationId,
        messageId,
        reason,
        status: "OPEN"
      }
    });

    res.json({ success: true, report });
  } catch (err) {
    next(err);
  }
};

// Admin lists reports
export const listReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ success: false, message: "Admin only" });

    const { status } = req.query;
    const where: any = {};
    if (status) where.status = String(status);

    const reports = await prisma.report.findMany({
      where,
      include: {
        reporter: { select: { id: true, fullName: true, email: true } },
        reportedUser: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, reports });
  } catch (err) {
    next(err);
  }
};

// Admin updates report status
export const updateReportStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== "admin") return res.status(403).json({ success: false, message: "Admin only" });

    const { id } = req.params;
    const { status } = req.body; // OPEN, UNDER_REVIEW, ACTION_TAKEN, DISMISSED, RESOLVED

    const validStatuses = ["OPEN", "UNDER_REVIEW", "ACTION_TAKEN", "DISMISSED", "RESOLVED"];
    if (!validStatuses.includes(status)) {
       return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const report = await prisma.report.update({
      where: { id },
      data: { status }
    });

    // We can log this to AuditLog if desired
    await prisma.auditLog.create({
       data: {
          adminId: req.user.id,
          action: "REPORT_STATUS_UPDATED",
          entity: "Report",
          entityId: id,
          details: JSON.stringify({ newStatus: status })
       }
    }).catch(() => {}); // Optional audit log

    res.json({ success: true, report });
  } catch (err) {
    next(err);
  }
};
