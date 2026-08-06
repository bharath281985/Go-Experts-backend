import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { NotificationService } from "../../modules/notifications/notification.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

function toAuditString(val: any, maxLen = 3000): string | null {
  if (val == null) return null;
  try {
    const text = typeof val === "string" ? val : JSON.stringify(val);
    if (text.length <= maxLen) return text;
    return JSON.stringify({
      truncated: true,
      originalLength: text.length,
      preview: text.slice(0, maxLen - 60),
    });
  } catch {
    return null;
  }
}

// Helper for notifications & activity/audit logs
async function logWorkflowAction(params: {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}) {
  const { userId, action, entity, entityId, description, oldValue, newValue } = params;

  let adminUserId: string | null = null;
  if (userId && userId !== "system") {
    const adminExists = await prisma.adminUser.findUnique({ where: { id: userId }, select: { id: true } }).catch(() => null);
    if (adminExists) adminUserId = adminExists.id;
  }
  if (!adminUserId) {
    const defaultAdmin = await prisma.adminUser.findFirst({ select: { id: true } }).catch(() => null);
    adminUserId = defaultAdmin?.id || null;
  }

  if (adminUserId) {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId,
          action: `${action}_${entity}`,
          description,
        },
      });
    } catch (err) {
      console.error("Non-fatal: ActivityLog creation failed:", err);
    }
  }

  // 2. Create audit log safely
  try {
    await prisma.auditLog.create({
      data: {
        actorId: adminUserId || null,
        action,
        entity,
        entityId,
        oldValue: toAuditString(oldValue),
        newValue: toAuditString(newValue),
        diff: oldValue && newValue ? toAuditString({ from: oldValue, to: newValue }) : null,
        ipAddress: "127.0.0.1",
      },
    });
  } catch (err) {
    console.error("Non-fatal: AuditLog creation failed:", err);
  }

  // 3. Queue notification asynchronously
  try {
    let templateCode: string | undefined;
    const variables: Record<string, any> = {
      userName: "User",
      projectTitle: "Project Title Placeholder",
      amount: "0",
      subscriptionPlan: "Plan Tier",
      meetingDate: new Date().toLocaleDateString(),
      supportTicketId: entityId,
    };

    if (entity === "Project" && action === "approve") templateCode = "PROJECT_APPROVED";
    if (entity === "Project" && action === "reject") templateCode = "PROJECT_REJECTED";
    if (entity === "Proposal" && action === "shortlist") templateCode = "PROPOSAL_SHORTLISTED";
    if (entity === "Contract" && action === "create") templateCode = "CONTRACT_CREATED";
    if (entity === "Task" && action === "assign") templateCode = "TASK_ASSIGNED";
    if (entity === "SupportTicket" && action === "create") templateCode = "SUPPORT_TICKET_CREATED";

    await NotificationService.enqueue({
      userId,
      type: entity.toLowerCase(),
      templateCode,
      title: `Workflow: ${action} on ${entity}`,
      message: description,
      channel: "omnichannel", // Enqueues for email, push, in_app
      priority: "normal",
      variables,
    });
  } catch (err) {
    console.error("Failed to enqueue workflow notification:", err);
  }
}

// ─── 1. PROJECT LIFECYCLE ──────────────────────────────────────────────────
export const approveProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const updated = await prisma.project.update({
      where: { id },
      data: { status: "approved" },
    });

    // Notify/Log
    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "approve",
      entity: "Project",
      entityId: id,
      description: `Project "${project.title}" has been approved by admin.`,
      oldValue: project,
      newValue: updated,
    });

    res.json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
};

export const rejectProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const updated = await prisma.project.update({
      where: { id },
      data: { status: "rejected" },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "reject",
      entity: "Project",
      entityId: id,
      description: `Project "${project.title}" has been rejected.`,
      oldValue: project,
      newValue: updated,
    });

    res.json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
};

export const publishProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const updated = await prisma.project.update({
      where: { id },
      data: { status: "published" },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "publish",
      entity: "Project",
      entityId: id,
      description: `Project "${project.title}" is now published and open for bids.`,
      oldValue: project,
      newValue: updated,
    });

    res.json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
};

// ─── 2. PROPOSAL ENGINE ────────────────────────────────────────────────────
export const submitProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, freelancerId, bidAmount, coverLetter } = req.body;
    if (!projectId || !freelancerId || !bidAmount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const proposal = await prisma.proposal.create({
      data: {
        projectId,
        freelancerId,
        bidAmount: parseFloat(bidAmount),
        coverLetter,
        status: "pending",
      },
    });

    await logWorkflowAction({
      userId: freelancerId,
      action: "submit",
      entity: "Proposal",
      entityId: proposal.id,
      description: `Freelancer submitted a proposal with bid $${bidAmount}`,
      newValue: proposal,
    });

    res.status(201).json({ success: true, proposal });
  } catch (err) {
    next(err);
  }
};

export const editProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { bidAmount, coverLetter } = req.body;

    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });
    if (existing.status !== "pending") {
      return res.status(400).json({ success: false, message: "Proposal can only be edited before shortlist" });
    }

    const updated = await prisma.proposal.update({
      where: { id },
      data: {
        bidAmount: bidAmount ? parseFloat(bidAmount) : existing.bidAmount,
        coverLetter: coverLetter ?? existing.coverLetter,
      },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "edit",
      entity: "Proposal",
      entityId: id,
      description: `Proposal edited. New bid: $${updated.bidAmount}`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const shortlistProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "shortlisted" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "shortlist",
      entity: "Proposal",
      entityId: id,
      description: `Proposal was shortlisted.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const rejectProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "rejected" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "reject",
      entity: "Proposal",
      entityId: id,
      description: `Proposal was rejected.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const interviewProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "interview" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "interview",
      entity: "Proposal",
      entityId: id,
      description: `Proposal status moved to interview scheduled.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const offerProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "offer" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "offer",
      entity: "Proposal",
      entityId: id,
      description: `Client sent an offer for this proposal.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

// Database Transaction #1: Proposal Accept → Contract Created → Project updates status
export const acceptProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { project: true, freelancer: true },
    });
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });

    const contractNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Accept proposal
      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status: "accepted" },
      });

      // 2. Reject all other proposals for this project
      await tx.proposal.updateMany({
        where: { projectId: proposal.projectId, id: { not: id } },
        data: { status: "rejected" },
      });

      // Find client user ID
      // If project has client name, look up user, or use system fallback
      const clientUser = await tx.user.findFirst({
        where: { fullName: proposal.project.client, role: "client" },
      });
      const clientId = clientUser?.id || proposal.freelancerId; // fallback to freelancer if no client found

      // 3. Create active/pending contract
      const contract = await tx.contract.create({
        data: {
          contractNumber,
          projectId: proposal.projectId,
          clientId,
          freelancerId: proposal.freelancerId,
          proposalId: id,
          status: "pending_acceptance",
        },
      });

      // 4. Update project status to active and link freelancer
      const updatedProject = await tx.project.update({
        where: { id: proposal.projectId },
        data: {
          status: "in_progress",
          freelancer: proposal.freelancer.fullName,
        },
      });

      // 5. Generate default milestones
      const milestone1 = await tx.milestone.create({
        data: {
          projectId: proposal.projectId,
          title: "Milestone 1: Project Kickoff & Setup",
          status: "Pending",
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      });

      const milestone2 = await tx.milestone.create({
        data: {
          projectId: proposal.projectId,
          title: "Milestone 2: Final Project Delivery",
          status: "Pending",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      });

      // 6. Generate default tasks from milestones
      await tx.task.create({
        data: {
          projectId: proposal.projectId,
          title: "Setup codebase & initialize git repository",
          priority: "High",
          status: "assigned",
          assignedTo: proposal.freelancer.fullName,
        },
      });

      await tx.task.create({
        data: {
          projectId: proposal.projectId,
          title: "Implement final integration and deployment",
          priority: "Medium",
          status: "draft",
          assignedTo: proposal.freelancer.fullName,
        },
      });

      return { updatedProposal, contract, updatedProject, milestones: [milestone1, milestone2] };
    });

    await logWorkflowAction({
      userId: proposal.freelancerId,
      action: "accept",
      entity: "Proposal",
      entityId: id,
      description: `Proposal accepted. Contract ${contractNumber} created and project moved to active.`,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const withdrawProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "withdrawn" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "withdraw",
      entity: "Proposal",
      entityId: id,
      description: `Freelancer withdrew their proposal.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

// ─── 3. CONTRACT ENGINE ────────────────────────────────────────────────────
export const createContractFromProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { proposalId } = req.params;
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { project: true, freelancer: true },
    });
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });

    const contractNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const clientUser = await prisma.user.findFirst({
      where: { fullName: proposal.project.client, role: "client" },
    });
    const clientId = clientUser?.id || proposal.freelancerId;

    const contract = await prisma.$transaction(async (tx) => {
      // Create contract
      const newContract = await tx.contract.create({
        data: {
          contractNumber,
          projectId: proposal.projectId,
          clientId,
          freelancerId: proposal.freelancerId,
          proposalId,
          status: "draft",
        },
      });

      // Generate milestones
      await tx.milestone.create({
        data: {
          projectId: proposal.projectId,
          title: "Contract Milestone: Delivery Phase",
          status: "Pending",
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      });

      return newContract;
    });

    await logWorkflowAction({
      userId: clientId,
      action: "create",
      entity: "Contract",
      entityId: contract.id,
      description: `Contract ${contractNumber} created draft from proposal.`,
    });

    res.status(201).json({ success: true, contract });
  } catch (err) {
    next(err);
  }
};

export const patchContractStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status required" });

    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Contract not found" });

    const updated = await prisma.contract.update({
      where: { id },
      data: { status },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "status_change",
      entity: "Contract",
      entityId: id,
      description: `Contract status changed to ${status}`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, contract: updated });
  } catch (err) {
    next(err);
  }
};

// ─── 4. MILESTONE ENGINE ───────────────────────────────────────────────────
export const createMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, title, dueDate } = req.body;
    if (!projectId || !title) {
      return res.status(400).json({ success: false, message: "projectId and title are required" });
    }

    const milestone = await prisma.milestone.create({
      data: { projectId, title, dueDate, status: "Pending" },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "create",
      entity: "Milestone",
      entityId: milestone.id,
      description: `New milestone "${title}" created.`,
      newValue: milestone,
    });

    res.status(201).json({ success: true, milestone });
  } catch (err) {
    next(err);
  }
};

// Database Transaction #4: Milestone Approved → Payment Release Placeholder
export const approveMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { id },
        data: { status: "Completed" },
      });

      // Find client user by full name
      const clientUser = await tx.user.findFirst({
        where: { fullName: milestone.project.client },
      });
      const userId = clientUser?.id || req.user?.id || "";

      // Create a Payment settlement placeholder
      const invoiceNumber = `INV-MS-${Math.floor(100000 + Math.random() * 900000)}`;
      const payment = await tx.payment.create({
        data: {
          userId,
          gateway: "Internal Wallet Release",
          amount: parseFloat((milestone.project.budget / 2).toFixed(2)), // release 50% budget partition
          currency: "INR",
          transactionId: invoiceNumber,
          status: "completed",
        },
      });

      return { updated, payment };
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "approve",
      entity: "Milestone",
      entityId: id,
      description: `Milestone approved. Released payment placeholder ${result.payment.transactionId} for $${result.payment.amount}`,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const rejectMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.milestone.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Milestone not found" });

    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Rejected" },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "reject",
      entity: "Milestone",
      entityId: id,
      description: `Milestone "${existing.title}" rejected.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, milestone: updated });
  } catch (err) {
    next(err);
  }
};

export const requestChangesMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.milestone.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Milestone not found" });

    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Changes Requested" },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "request_changes",
      entity: "Milestone",
      entityId: id,
      description: `Changes requested on milestone "${existing.title}".`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, milestone: updated });
  } catch (err) {
    next(err);
  }
};

// ─── 5. TASK ENGINE ────────────────────────────────────────────────────────
export const createTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, title, assignedTo, priority, dueDate } = req.body;
    if (!projectId || !title) {
      return res.status(400).json({ success: false, message: "projectId and title are required" });
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        assignedTo,
        priority: priority || "Medium",
        dueDate,
        status: "assigned",
      },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "create",
      entity: "Task",
      entityId: task.id,
      description: `New task "${title}" assigned to ${assignedTo || "unassigned"}`,
      newValue: task,
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    next(err);
  }
};

export const patchTaskStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Task not found" });

    const updated = await prisma.task.update({
      where: { id },
      data: { status },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "status_change",
      entity: "Task",
      entityId: id,
      description: `Task status updated to ${status}`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, task: updated });
  } catch (err) {
    next(err);
  }
};

export const createTaskComment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { comment, author } = req.body;
    if (!comment) return res.status(400).json({ success: false, message: "comment content required" });

    const authorName = author || req.user?.email || "System User";
    const authorId = req.user?.id || "system";

    const newComment = await prisma.taskComment.create({
      data: {
        taskId: id,
        authorId,
        author: authorName,
        comment,
      },
    });

    res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    next(err);
  }
};

export const createTaskAttachment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { filename, filepath, filesize } = req.body;

    if (!filename || !filepath) {
      return res.status(400).json({ success: false, message: "filename and filepath required" });
    }

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: id,
        filename,
        filepath,
        filesize: filesize ? parseInt(filesize) : 0,
      },
    });

    res.status(201).json({ success: true, attachment });
  } catch (err) {
    next(err);
  }
};

// ─── 6. REVIEW ENGINE ───────────────────────────────────────────────────────
// Database Transaction #5: Project Completed → Review prompt & triggers Review Engine
export const createReview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, reviewerId, revieweeId, rating, comment } = req.body;
    if (!projectId || !reviewerId || !revieweeId || rating === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the review
      const review = await tx.review.create({
        data: {
          projectId,
          reviewerId,
          revieweeId,
          rating: parseFloat(rating),
          comment,
        },
      });

      // 2. Update ratings average in freelancer/client profile
      // Check reviewer/reviewee role type
      const targetUser = await tx.user.findUnique({ where: { id: revieweeId } });
      if (targetUser?.role === "freelancer") {
        const allReviews = await tx.review.findMany({ where: { revieweeId } });
        const avg = allReviews.reduce((acc, curr) => acc + curr.rating, 0) / allReviews.length;
        await tx.freelancerProfile.update({
          where: { userId: revieweeId },
          data: { rating: avg },
        });
      }

      // 3. Auto-close project/contract if both parties reviewed (or when reviewing)
      const project = await tx.project.findUnique({ where: { id: projectId } });
      let updatedProject = null;
      if (project && project.status !== "completed") {
        updatedProject = await tx.project.update({
          where: { id: projectId },
          data: { status: "completed" },
        });

        // Also complete contracts linked to this project
        await tx.contract.updateMany({
          where: { projectId },
          data: { status: "completed" },
        });
      }

      return { review, updatedProject };
    });

    await logWorkflowAction({
      userId: reviewerId,
      action: "submit",
      entity: "Review",
      entityId: result.review.id,
      description: `Review submitted for project. Rating given: ${rating}`,
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
