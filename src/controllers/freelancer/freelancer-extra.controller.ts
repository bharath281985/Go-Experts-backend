import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import {
  HttpError,
  debitWalletForSelf,
  listInvoicesForUser,
  listMeetingsForUser,
  getJsonSetting,
  setJsonSetting,
  listConversationsForUser,
  listMessagesForConversation,
  createMessageForUser,
  purchaseSubscriptionForSelf,
  listSubscriptionsForUser,
  getUserWalletPayload,
} from "../../common/helpers/portal-shared.js";

import { FREELANCER_PROFILE_LIST_SELECT } from "../../common/helpers/prisma-compat.js";

async function loadFreelancerUser(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { freelancerProfile: { select: FREELANCER_PROFILE_LIST_SELECT } },
  });
}

function handleError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  next(err);
}

function requireUser(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

function freelancerNeedles(user: { fullName: string; email: string }) {
  return [user.fullName, user.email].map((v) => String(v || "").trim()).filter(Boolean);
}

// ==========================================
// PROPOSALS
// ==========================================

export const listFreelancerProposals = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await prisma.proposal.findMany({
      where: { freelancerId: userId, deletedAt: null },
      include: { project: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createFreelancerProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const projectId = String(body.projectId || "").trim();
    const bidAmount = Number(body.bidAmount);
    if (!projectId || !Number.isFinite(bidAmount)) {
      return res.status(400).json({ success: false, message: "projectId and bidAmount are required" });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const existing = await prisma.proposal.findFirst({
      where: { projectId, freelancerId: userId, deletedAt: null, status: { notIn: ["withdrawn", "rejected"] } },
    });
    if (existing) return res.status(409).json({ success: false, message: "You already applied to this project" });

    const proposal = await prisma.proposal.create({
      data: {
        projectId,
        freelancerId: userId,
        bidAmount,
        coverLetter: body.coverLetter ? String(body.coverLetter) : null,
        status: "pending",
      },
    });

    res.status(201).json({ success: true, message: "Proposal submitted", data: proposal });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const withdrawFreelancerProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const proposal = await prisma.proposal.findFirst({
      where: { id: req.params.id, freelancerId: userId, deletedAt: null },
    });
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "withdrawn" } });
    res.json({ success: true, message: "Proposal withdrawn", data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// CONTRACTS
// ==========================================

export const listFreelancerContracts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await prisma.contract.findMany({
      where: { freelancerId: userId, deletedAt: null },
      include: { project: true, client: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// TASKS
// ==========================================

function freelancerTaskWhere(user: { fullName: string; email: string }) {
  const needles = freelancerNeedles(user);
  return {
    deletedAt: null,
    OR: [
      ...needles.map((n) => ({ assignedTo: { contains: n } })),
      ...needles.map((n) => ({ project: { is: { freelancer: { contains: n } } } })),
    ],
  };
}

export const listFreelancerTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadFreelancerUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const rows = await prisma.task.findMany({
      where: freelancerTaskWhere(user),
      include: { project: { select: { id: true, title: true, client: true } }, checklists: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateFreelancerTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadFreelancerUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const task = await prisma.task.findFirst({ where: { id: req.params.id, ...freelancerTaskWhere(user) } });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const body = req.body || {};
    const data: any = {};
    if (body.status != null) data.status = String(body.status).trim();
    if (body.progress != null && body.progress !== "") data.progress = Number(body.progress);
    if (body.priority != null) data.priority = String(body.priority).trim();
    if (body.dueDate != null) data.dueDate = String(body.dueDate).trim() || null;

    const updated = await prisma.task.update({ where: { id: task.id }, data });
    res.json({ success: true, message: "Task updated", data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// MEETINGS
// ==========================================

export const listFreelancerMeetings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadFreelancerUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const rows = await listMeetingsForUser(user);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// MESSAGES
// ==========================================

export const listFreelancerMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadFreelancerUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
    const portalUser = { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
    if (conversationId) {
      const rows = await listMessagesForConversation(portalUser, conversationId);
      return res.json({ success: true, rows, total: rows.length });
    }

    const rows = await listConversationsForUser(portalUser);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createFreelancerMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadFreelancerUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const body = req.body || {};
    const result = await createMessageForUser(
      { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
      { conversationId: body.conversationId, content: body.content, title: body.title },
    );
    res.status(201).json({ success: true, message: "Message sent", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// REVIEWS
// ==========================================

export const listFreelancerReviews = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await prisma.review.findMany({
      where: { revieweeId: userId },
      include: { reviewer: { select: { fullName: true, avatarUrl: true } }, project: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// WALLET
// ==========================================

export const withdrawFreelancerWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const result = await debitWalletForSelf(userId, Number(body.amount), "debit", body.description || "Freelancer withdrawal");
    res.status(201).json({ success: true, message: "Withdrawal successful", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// INVOICES
// ==========================================

export const listFreelancerInvoices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await listInvoicesForUser(userId);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// SUBSCRIPTIONS
// ==========================================

export const listFreelancerSubscriptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await listSubscriptionsForUser(userId);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const purchaseFreelancerSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const planId = String(body.planId || "").trim();
    if (!planId) return res.status(400).json({ success: false, message: "planId is required" });

    const result = await purchaseSubscriptionForSelf(userId, planId, body.gateway, body.transactionId);
    res.status(201).json({ success: true, message: "Subscription purchased", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// EXPERIENCE / EDUCATION / CERTIFICATES / SKILLS
// ==========================================

export const getFreelancerExperience = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "experience", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const putFreelancerExperience = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: "items array is required" });
    await setJsonSetting(userId, "experience", items);
    res.json({ success: true, message: "Experience updated", rows: items });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getFreelancerEducation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "education", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const putFreelancerEducation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: "items array is required" });
    await setJsonSetting(userId, "education", items);
    res.json({ success: true, message: "Education updated", rows: items });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getFreelancerCertificates = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "certificates", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const putFreelancerCertificates = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: "items array is required" });
    await setJsonSetting(userId, "certificates", items);
    res.json({ success: true, message: "Certificates updated", rows: items });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getFreelancerSkills = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "skills-detail", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const putFreelancerSkills = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(items)) return res.status(400).json({ success: false, message: "items array is required" });
    await setJsonSetting(userId, "skills-detail", items);

    const names = items
      .map((i: any) => (typeof i === "string" ? i : i?.name))
      .filter(Boolean)
      .join(", ");
    await prisma.freelancerProfile.upsert({
      where: { userId },
      update: { skills: names },
      create: { userId, skills: names },
    });

    res.json({ success: true, message: "Skills updated", rows: items });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// SAVED PROJECTS
// ==========================================

export const listSavedProjects = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const saved = await getJsonSetting(userId, "saved-projects", [] as string[]);
    const rows = saved.length
      ? await prisma.project.findMany({ where: { id: { in: saved }, deletedAt: null } })
      : [];
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const saveProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const projectId = String(req.body?.projectId || "").trim();
    if (!projectId) return res.status(400).json({ success: false, message: "projectId is required" });

    const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const saved = await getJsonSetting(userId, "saved-projects", [] as string[]);
    if (!saved.includes(projectId)) saved.push(projectId);
    await setJsonSetting(userId, "saved-projects", saved);

    res.status(201).json({ success: true, message: "Project saved", data: project });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const unsaveProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const saved = await getJsonSetting(userId, "saved-projects", [] as string[]);
    const next = saved.filter((id) => id !== req.params.id);
    await setJsonSetting(userId, "saved-projects", next);
    res.json({ success: true, message: "Project removed from saved list", rows: next });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// SETTINGS
// ==========================================

export const getFreelancerSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const data = await getJsonSetting(userId, "settings", {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      language: "en",
      timezone: "UTC",
    });
    res.json({ success: true, data });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateFreelancerSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const existing = await getJsonSetting(userId, "settings", {});
    const merged = { ...existing, ...(req.body || {}) };
    await setJsonSetting(userId, "settings", merged);
    res.json({ success: true, message: "Settings updated", data: merged });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// ANALYTICS
// ==========================================

export const getFreelancerAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const [proposalsByStatus, contractsByStatus, reviews, wallet] = await Promise.all([
      prisma.proposal.groupBy({ by: ["status"], where: { freelancerId: userId, deletedAt: null }, _count: true }),
      prisma.contract.groupBy({ by: ["status"], where: { freelancerId: userId, deletedAt: null }, _count: true }),
      prisma.review.findMany({ where: { revieweeId: userId }, select: { rating: true } }),
      prisma.wallet.findUnique({ where: { userId } }),
    ]);

    const avgRating = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length) * 100) / 100
      : 0;

    res.json({
      success: true,
      data: {
        proposalsByStatus: proposalsByStatus.map((s) => ({ status: s.status, count: s._count })),
        contractsByStatus: contractsByStatus.map((s) => ({ status: s.status, count: s._count })),
        avgRating,
        reviewCount: reviews.length,
        walletBalance: Number(wallet?.balance ?? 0),
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// PROFILE COVER
// ==========================================

export const updateFreelancerCover = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const coverUrl = body.coverUrl != null ? String(body.coverUrl).trim() : "";
    const avatarUrl = body.avatarUrl != null ? String(body.avatarUrl).trim() : null;

    const existing = await getJsonSetting(userId, "settings", {} as Record<string, unknown>);
    const merged = { ...existing, coverUrl };
    await setJsonSetting(userId, "settings", merged);

    if (avatarUrl) {
      await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    }

    res.json({ success: true, message: "Cover updated", data: { coverUrl, avatarUrl } });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// CLIENTS / RESUME / REFERRALS / EARNINGS / ACTIVITY
// ==========================================

export const listFreelancerClients = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const contracts = await prisma.contract.findMany({
      where: { freelancerId: userId, deletedAt: null },
      include: {
        client: { select: { id: true, fullName: true, email: true, avatarUrl: true, city: true, country: true } },
        project: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byClient = new Map<string, any>();
    for (const c of contracts) {
      const key = c.clientId || c.client?.email || "unknown";
      if (!byClient.has(key)) {
        byClient.set(key, {
          id: c.clientId,
          name: c.client?.fullName || "Client",
          email: c.client?.email || "",
          avatar: c.client?.avatarUrl || null,
          city: c.client?.city || "",
          country: c.client?.country || "",
          contracts: 0,
          projects: [] as any[],
        });
      }
      const row = byClient.get(key);
      row.contracts += 1;
      if (c.project) row.projects.push(c.project);
    }

    const rows = Array.from(byClient.values());
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getFreelancerResume = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const data = await getJsonSetting(userId, "resume", {
      template: "modern",
      sections: {},
      headline: "",
      summary: "",
    });
    res.json({ success: true, data });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const putFreelancerResume = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const existing = await getJsonSetting(userId, "resume", {});
    const merged = { ...existing, ...(req.body || {}) };
    await setJsonSetting(userId, "resume", merged);
    res.json({ success: true, message: "Resume saved", data: merged });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getFreelancerReferrals = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const referrals = await prisma.referral.findMany({
      where: { OR: [{ referrerId: userId }, { refereeId: userId }] },
      orderBy: { createdAt: "desc" },
      include: {
        referee: { select: { fullName: true, email: true } },
        rewards: true,
      },
    }).catch(() => []);

    const stored = await getJsonSetting(userId, "referrals", {
      code: `GE-${userId.slice(0, 6).toUpperCase()}`,
      history: [] as any[],
    });

    res.json({
      success: true,
      data: {
        code: (stored as any).code,
        history: referrals.length
          ? referrals.map((r: any) => ({
              id: r.id,
              name: r.referee?.fullName || r.refereeId,
              email: r.referee?.email || "",
              status: r.status,
              date: r.createdAt,
              reward: r.rewards?.[0]?.amount ?? 0,
            }))
          : (stored as any).history || [],
        leaderboard: (stored as any).leaderboard || [],
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getFreelancerEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const wallet = await getUserWalletPayload(userId);
    const payments = await prisma.payment.findMany({
      where: { userId, status: { in: ["completed", "success", "paid"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const byMonth: Record<string, number> = {};
    for (const p of payments) {
      const key = new Date(p.createdAt).toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + Number(p.amount || 0);
    }

    res.json({
      success: true,
      data: {
        available: wallet.balance ?? 0,
        pending: 0,
        lifetime: wallet.totalCredits ?? wallet.balance ?? 0,
        currency: wallet.currency || "USD",
        series: Object.entries(byMonth).map(([month, amount]) => ({ month, amount })),
        payments,
        transactions: wallet.transactions || [],
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listFreelancerActivity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const [notifications, proposals, contracts, payments, wallet, meetings, customLogs] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.proposal.findMany({
        where: { freelancerId: userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, status: true, updatedAt: true, project: { select: { title: true } } },
      }),
      prisma.contract.findMany({
        where: { freelancerId: userId, deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, status: true, updatedAt: true, contractNumber: true },
      }),
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.walletTransaction.findMany({
        where: { wallet: { userId } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.meeting.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      getJsonSetting(userId, "activity", [] as any[]),
    ]);

    const actualCustomLogs = Array.isArray(customLogs) ? customLogs : [];

    const rows = [
      ...notifications.map((n) => ({
        id: n.id,
        type: "notification",
        title: n.title || n.type || "Notification",
        detail: n.message || "",
        at: n.createdAt,
      })),
      ...proposals.map((p) => ({
        id: p.id,
        type: "proposal",
        title: `Proposal · ${p.project?.title || "Project"}`,
        detail: p.status,
        at: p.updatedAt,
      })),
      ...contracts.map((c) => ({
        id: c.id,
        type: "contract",
        title: `Contract · ${c.contractNumber || c.id.slice(0, 8)}`,
        detail: c.status,
        at: c.updatedAt,
      })),
      ...payments.map((pm) => ({
        id: pm.id,
        type: "payment",
        title: `Payment ${pm.status || "Received"}`,
        detail: `Amount: ${pm.currency || "INR"} ${pm.amount}`,
        at: pm.createdAt,
      })),
      ...wallet.map((w) => ({
        id: w.id,
        type: "wallet",
        title: `Wallet ${w.direction === "credit" ? "Credit" : "Debit"}`,
        detail: `${w.description || "Wallet transaction"} · ${w.amount}`,
        at: w.createdAt,
      })),
      ...meetings.map((m) => ({
        id: m.id,
        type: "meeting",
        title: `Meeting · ${m.title || "Session"}`,
        detail: `Status: ${m.status || "scheduled"}`,
        at: m.createdAt,
      })),
      ...actualCustomLogs.map((c) => ({
        id: c.id,
        type: c.type || "activity",
        title: c.title,
        detail: c.detail,
        at: c.at || c.createdAt,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createFreelancerActivity = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const title = String(body.title || "Activity").trim();
    const type = String(body.type || "profile").trim().toLowerCase();
    const detail = String(body.detail || "").trim();

    const existing = await getJsonSetting(userId, "activity", [] as any[]);
    const list = Array.isArray(existing) ? existing : [];
    const newEntry = {
      id: `ACT-${Date.now().toString(36).toUpperCase()}`,
      type,
      title,
      detail,
      at: new Date().toISOString(),
    };
    const nextList = [newEntry, ...list].slice(0, 15);
    try {
      await setJsonSetting(userId, "activity", nextList);
    } catch {
      // ignore
    }
    res.status(201).json({ success: true, message: "Activity logged", data: newEntry, rows: nextList });
  } catch (err) {
    handleError(err, res, next);
  }
};