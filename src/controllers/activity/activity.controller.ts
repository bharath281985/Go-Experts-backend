import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

// IDOR protected fetch
export const getBusinessActivities = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { contextType, contextId } = req.query;
    if (!contextType || !contextId) {
      return res.status(400).json({ success: false, message: "contextType and contextId required" });
    }

    // Basic IDOR check
    let authorized = req.user?.role === "admin";

    if (!authorized && contextType === "PROJECT") {
      const project = await prisma.project.findUnique({
        where: { id: String(contextId) },
        include: { proposals: true, invitations: true, shortlists: true, contracts: true }
      });
      if (project) {
        if (project.client === userId) authorized = true;
        if (project.proposals.some(p => p.freelancerId === userId)) authorized = true;
        if (project.invitations.some(i => i.freelancerId === userId)) authorized = true;
        if (project.shortlists.some(s => s.freelancerId === userId)) authorized = true;
        if (project.contracts.some(c => c.freelancerId === userId)) authorized = true;
      }
    }

    if (!authorized && contextType === "PROJECT") {
      return res.status(403).json({ success: false, message: "Access denied to this timeline" });
    }

    const activities = await prisma.businessActivity.findMany({
      where: {
        contextType: String(contextType),
        contextId: String(contextId)
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, activities });
  } catch (error) {
    next(error);
  }
};
