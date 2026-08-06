import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import {
  HttpError,
  getUserWalletPayload,
  creditWalletForSelf,
  debitWalletForSelf,
  listInvoicesForUser,
  listMeetingsForUser,
  createMeetingForUser,
  listUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getJsonSetting,
  setJsonSetting,
  listConversationsForUser,
  listMessagesForConversation,
  createMessageForUser,
  purchaseSubscriptionForSelf,
  listSubscriptionsForUser,
  money,
} from "../../common/helpers/portal-shared.js";

async function loadClientUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { clientProfile: true },
  });
  return user;
}

function clientNeedles(user: { fullName: string; email: string }, profile: { company?: string | null } | null) {
  return [user.fullName, user.email, profile?.company]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
}

function clientProjectWhere(user: { fullName: string; email: string }, profile: { company?: string | null } | null) {
  const needles = clientNeedles(user, profile);
  return {
    deletedAt: null,
    OR: needles.length ? needles.map((n) => ({ client: { contains: n } })) : [{ client: "__none__" }],
  };
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

// ==========================================
// DASHBOARD
// ==========================================

export const getClientDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const projWhere = clientProjectWhere(user, user.clientProfile);

    const [
      projectsTotal,
      projectsOpen,
      projectsActive,
      projectsCompleted,
      contracts,
      invoices,
      wallet,
      unreadNotifications,
      recentProjects,
    ] = await Promise.all([
      prisma.project.count({ where: projWhere }),
      prisma.project.count({ where: { ...projWhere, status: "open" } }),
      prisma.project.count({ where: { ...projWhere, status: "in_progress" } }),
      prisma.project.count({ where: { ...projWhere, status: "completed" } }),
      prisma.contract.findMany({
        where: { clientId: userId, deletedAt: null },
        include: { project: true, freelancer: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
      getUserWalletPayload(userId),
      prisma.notification.count({
        where: {
          status: { notIn: ["cancelled", "draft"] },
          readAt: null,
          NOT: { status: "read" },
          OR: [{ userId }, { AND: [{ userId: null }, { role: "client" }] }],
        },
      }),
      prisma.project.findMany({ where: projWhere, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

    const totalSpend = Number(user.clientProfile?.totalSpend ?? 0);

    res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          name: user.fullName,
          fullName: user.fullName,
          firstName: (user.fullName || "there").split(" ")[0],
          email: user.email,
          company: user.clientProfile?.company || null,
          companyName: user.clientProfile?.company || user.fullName,
          industry: user.clientProfile?.industry || null,
          avatar: user.avatarUrl || null,
          avatarUrl: user.avatarUrl || null,
        },
        kpis: [
          { key: "projects", label: "Total Projects", value: String(projectsTotal) },
          { key: "open", label: "Open Projects", value: String(projectsOpen) },
          { key: "active", label: "Active Projects", value: String(projectsActive) },
          { key: "completed", label: "Completed Projects", value: String(projectsCompleted) },
          { key: "spend", label: "Total Spend", value: money(totalSpend) },
          { key: "balance", label: "Wallet Balance", value: money(wallet.balance, wallet.currency) },
        ],
        monthlyHiring: [],
        revenueExpense: [],
        pipeline: [],
        todayMeetings: [],
        todayTasks: [],
        pendingApprovals: [],
        pendingPayments: [],
        latestApplications: [],
        latestMessages: [],
        latestNotifications: [],
        latestReviews: [],
        aiSuggestions: [],
        recentProjects,
        recentContracts: contracts.map((c) => ({
          id: c.id,
          contractNumber: c.contractNumber,
          project: c.project?.title || "Project",
          freelancer: c.freelancer?.fullName || "Freelancer",
          status: c.status,
          createdAt: c.createdAt,
        })),
        recentInvoices: invoices,
        wallet,
        counts: { notifications: unreadNotifications, projects: projectsTotal, contracts: contracts.length, applications: 0 },
        meta: { walletBalance: wallet.balance },
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// PROFILE
// ==========================================

export const getClientProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || "",
        avatarUrl: user.avatarUrl || "",
        bio: user.bio || "",
        city: user.city || "",
        country: user.country || "",
        company: user.clientProfile?.company || "",
        industry: user.clientProfile?.industry || "",
        totalSpend: Number(user.clientProfile?.totalSpend ?? 0),
        projectsPosted: user.clientProfile?.projectsPosted ?? 0,
        status: user.status,
        verified: Boolean(user.isVerified || user.verified),
        role: user.role,
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateClientProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const body = req.body || {};
    const existing = await loadClientUser(userId);
    if (!existing) return res.status(404).json({ success: false, message: "User not found" });

    const fullName = body.fullName != null ? String(body.fullName).trim() : existing.fullName;
    if (!fullName) return res.status(400).json({ success: false, message: "Full name is required" });

    await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        phone: body.phone != null ? String(body.phone).trim() || null : existing.phone,
        bio: body.bio != null ? String(body.bio) : existing.bio,
        avatarUrl: body.avatarUrl != null ? String(body.avatarUrl).trim() || null : existing.avatarUrl,
        city: body.city != null ? String(body.city).trim() || null : existing.city,
        country: body.country != null ? String(body.country).trim() || null : existing.country,
      },
    });

    await prisma.clientProfile.upsert({
      where: { userId },
      update: {
        company: body.company != null ? String(body.company).trim() || null : existing.clientProfile?.company ?? null,
        industry: body.industry != null ? String(body.industry).trim() || null : existing.clientProfile?.industry ?? null,
      },
      create: {
        userId,
        company: body.company != null ? String(body.company).trim() || null : null,
        industry: body.industry != null ? String(body.industry).trim() || null : null,
      },
    });

    return getClientProfile(req, res, next);
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// PROJECTS
// ==========================================

export const listClientProjects = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const where = clientProjectWhere(user, user.clientProfile);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));

    const [rows, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { proposals: { select: { id: true } }, tasks: { select: { id: true, status: true } } },
      }),
      prisma.project.count({ where }),
    ]);

    res.json({ success: true, rows, total });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getClientPipeline = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const where = clientProjectWhere(user, user.clientProfile);
    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const grouped = [
      { stage: "Scoping", count: 0, value: 0, projects: [] as any[] },
      { stage: "Review", count: 0, value: 0, projects: [] as any[] },
      { stage: "In Progress", count: 0, value: 0, projects: [] as any[] },
      { stage: "Completed", count: 0, value: 0, projects: [] as any[] },
    ];

    for (const p of projects) {
      let stageIndex = 0; // Scoping
      if (p.status === "review" || p.status === "Published") stageIndex = 1;
      if (p.status === "in_progress" || p.status === "In Progress") stageIndex = 2;
      if (p.status === "completed" || p.status === "Completed") stageIndex = 3;

      grouped[stageIndex].projects.push(p);
      grouped[stageIndex].count++;
      grouped[stageIndex].value += p.budget || 0;
    }

    res.json({ success: true, pipeline: grouped });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createClientProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const body = req.body || {};
    const title = String(body.title || "").trim() || "Untitled Project";
    const budget = Number.isFinite(Number(body.budget)) ? Number(body.budget) : 0;
    const category = String(body.category || "").trim() || "Engineering";
    const technology = String(body.technology || "").trim() || "Various";

    const project = await prisma.project.create({
      data: {
        title,
        client: user.fullName,
        budget,
        category,
        technology,
        timeline: body.timeline ? String(body.timeline) : null,
        status: body.status ? String(body.status) : "open",
      },
    });

    await prisma.clientProfile.upsert({
      where: { userId },
      update: { projectsPosted: { increment: 1 } },
      create: { userId, projectsPosted: 1 },
    });

    res.status(201).json({ success: true, message: "Project created", data: project });
  } catch (err) {
    handleError(err, res, next);
  }
};

async function findOwnedProject(userId: string, projectId: string) {
  const user = await loadClientUser(userId);
  if (!user) throw new HttpError("User not found", 404);
  const where = clientProjectWhere(user, user.clientProfile);
  const project = await prisma.project.findFirst({ where: { ...where, id: projectId } });
  return project;
}

export const getClientProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const project = await findOwnedProject(userId, req.params.id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const [tasks, proposals, contracts] = await Promise.all([
      prisma.task.findMany({ where: { projectId: project.id, deletedAt: null } }),
      prisma.proposal.findMany({
        where: { projectId: project.id, deletedAt: null },
        include: { freelancer: { select: { fullName: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contract.findMany({ where: { projectId: project.id, deletedAt: null } }),
    ]);

    res.json({ success: true, data: { ...project, tasks, proposals, contracts } });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateClientProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const project = await findOwnedProject(userId, req.params.id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const body = req.body || {};
    const data: any = {};
    if (body.title != null) data.title = String(body.title).trim();
    if (body.budget != null && body.budget !== "") data.budget = Number(body.budget);
    if (body.category != null) data.category = String(body.category).trim();
    if (body.technology != null) data.technology = String(body.technology).trim();
    if (body.timeline != null) data.timeline = String(body.timeline).trim() || null;
    if (body.status != null) data.status = String(body.status).trim();
    if (body.freelancer != null) data.freelancer = String(body.freelancer).trim() || null;

    const updated = await prisma.project.update({ where: { id: project.id }, data });
    res.json({ success: true, message: "Project updated", data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const deleteClientProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const project = await findOwnedProject(userId, req.params.id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } });
    res.json({ success: true, message: "Project deleted" });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listProjectApplications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const project = await findOwnedProject(userId, req.params.id);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const rows = await prisma.proposal.findMany({
      where: { projectId: project.id, deletedAt: null },
      include: { freelancer: { select: { id: true, fullName: true, email: true, avatarUrl: true, bio: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

async function updateProposalStatusForClient(userId: string, proposalId: string, status: string) {
  const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, deletedAt: null } });
  if (!proposal) throw new HttpError("Proposal not found", 404);
  const project = await findOwnedProject(userId, proposal.projectId);
  if (!project) throw new HttpError("Proposal not found", 404);

  const updatedProposal = await prisma.proposal.update({ where: { id: proposalId }, data: { status } });

  // If proposal is accepted, automatically create a draft/active contract
  if (status === "accepted") {
    const existingContract = await prisma.contract.findFirst({
      where: { proposalId: proposal.id }
    });

    if (!existingContract) {
      await prisma.contract.create({
        data: {
          contractNumber: `CTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          projectId: proposal.projectId,
          clientId: userId,
          freelancerId: proposal.freelancerId,
          proposalId: proposal.id,
          status: "pending_acceptance",
        }
      });
    }
  }

  return updatedProposal;
}

export const acceptProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const updated = await updateProposalStatusForClient(userId, req.params.id, "accepted");
    res.json({ success: true, message: "Proposal accepted", data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const rejectProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const updated = await updateProposalStatusForClient(userId, req.params.id, "rejected");
    res.json({ success: true, message: "Proposal rejected", data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const interviewProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const updated = await updateProposalStatusForClient(userId, req.params.id, "interview");
    res.json({ success: true, message: "Proposal moved to interview", data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// CONTRACTS / TASKS
// ==========================================

export const listClientContracts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const rows = await prisma.contract.findMany({
      where: { clientId: userId, deletedAt: null },
      include: { project: true, freelancer: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listClientTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadClientUser(userId);
    let rows: any[] = [];
    if (user) {
      const projWhere = clientProjectWhere(user, user.clientProfile);
      rows = await prisma.task.findMany({
        where: { deletedAt: null, project: { is: projWhere } },
        include: { project: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!rows.length) {
      rows = await prisma.task.findMany({
        where: { deletedAt: null },
        include: { project: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    }

    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const addClientTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const body = req.body || {};
    const title = String(body.title || "").trim();
    if (!title) return res.status(400).json({ success: false, message: "title is required" });

    const projectId = String(body.projectId || "").trim();
    if (!projectId) return res.status(400).json({ success: false, message: "projectId is required" });

    const task = await prisma.task.create({
      data: {
        title,
        projectId,
        priority: body.priority || "Medium",
        status: body.status || "Todo",
        progress: body.progress != null && !isNaN(Number(body.progress)) ? Number(body.progress) : 0,
        assignedTo: body.assignee || null,
        dueDate: body.dueDate || null,
      },
      include: { project: { select: { id: true, title: true } } },
    });

    res.status(201).json({ success: true, message: "Task added successfully", data: task });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateClientTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const taskId = String(req.params.id || "").trim();
    let task = await prisma.task.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id: taskId },
          { id: { contains: taskId } },
          { title: taskId },
          { title: { contains: taskId } },
        ],
      },
    });

    const body = req.body || {};

    if (!task) {
      let validProjId = body.projectId ? String(body.projectId).trim() : null;
      if (validProjId) {
        const proj = await prisma.project.findUnique({ where: { id: validProjId } });
        if (!proj) validProjId = null;
      }
      if (!validProjId) {
        const user = await loadClientUser(userId);
        if (user) {
          const projWhere = clientProjectWhere(user, user.clientProfile);
          const firstProj = await prisma.project.findFirst({ where: projWhere });
          if (firstProj) validProjId = firstProj.id;
        }
      }

      if (!validProjId) {
        const anyProj = await prisma.project.findFirst({ where: { deletedAt: null } });
        if (anyProj) validProjId = anyProj.id;
      }

      if (validProjId) {
        task = await prisma.task.create({
          data: {
            title: String(body.title || "Task").trim(),
            projectId: validProjId,
            priority: body.priority || "Medium",
            status: body.status || "Todo",
            progress: body.progress != null && !isNaN(Number(body.progress)) ? Number(body.progress) : 0,
            assignedTo: body.assignee ? String(body.assignee).trim() : null,
            dueDate: body.dueDate || body.due || null,
          },
          include: { project: { select: { id: true, title: true } } },
        });
        return res.json({ success: true, message: "Task updated successfully", data: task });
      }
    }

    const data: any = {};
    if (body.title != null && String(body.title).trim()) data.title = String(body.title).trim();
    if (body.priority != null) data.priority = String(body.priority).trim();
    if (body.status != null) data.status = String(body.status).trim();
    if (body.progress != null && !isNaN(Number(body.progress))) data.progress = Number(body.progress);
    if (body.assignee != null) data.assignedTo = String(body.assignee).trim() || null;
    if (body.dueDate != null || body.due != null) data.dueDate = body.dueDate || body.due || null;

    if (body.projectId != null && String(body.projectId).trim()) {
      const pId = String(body.projectId).trim();
      const projExists = await prisma.project.findUnique({ where: { id: pId } });
      if (projExists) {
        data.projectId = pId;
      }
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
      include: { project: { select: { id: true, title: true } } },
    });
    res.json({ success: true, message: "Task updated successfully", data: updated });
    if (body.assignee != null) data.assignedTo = String(body.assignee).trim() || null;
    if (body.dueDate != null || body.due != null) data.dueDate = body.dueDate || body.due || null;

    if (body.projectId != null && String(body.projectId).trim()) {
      const pId = String(body.projectId).trim();
      const projExists = await prisma.project.findUnique({ where: { id: pId } });
      if (projExists) {
        data.projectId = pId;
      }
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
      include: { project: { select: { id: true, title: true } } },
    });
    res.json({ success: true, message: "Task updated successfully", data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const deleteClientTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const taskId = String(req.params.id || "").trim();
    const task = await prisma.task.findFirst({
      where: { OR: [{ id: taskId }, { title: taskId }] },
    });

    if (task) {
      await prisma.task.update({ where: { id: task.id }, data: { deletedAt: new Date() } });
    }

    res.json({ success: true, message: "Task deleted" });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// MEETINGS
// ==========================================

export const listClientMeetings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const rows = await listMeetingsForUser(user, [user.clientProfile?.company]);

    // Fetch freelancer contacts for the client
    const { getJsonSetting } = await import("../../common/helpers/portal-shared.js");
    const contracts = await prisma.contract.findMany({
      where: { clientId: userId, deletedAt: null },
      select: {
        freelancer: {
          select: { id: true, fullName: true, email: true }
        }
      }
    });

    const storedIds = await getJsonSetting<string[]>(userId, "conversations", []);
    const needles = [user.fullName, user.email].map((v) => String(v || "").trim()).filter(Boolean);
    const or: any[] = needles.map((n) => ({ name: { contains: n } }));
    if (storedIds.length) or.push({ id: { in: storedIds } });

    const conversations = or.length ? await prisma.conversation.findMany({
      where: { deletedAt: null, OR: or },
      select: { name: true }
    }) : [];

    const contactsMap = new Map<string, string>();

    contracts.forEach(c => {
      if (c.freelancer) {
        contactsMap.set(c.freelancer.fullName, c.freelancer.email);
      }
    });

    for (const conv of conversations) {
      const emailMatch = conv.name.match(/\(([^)]+)\)/);
      if (emailMatch?.[1]) {
        const namePart = conv.name.split("(")[0].trim();
        contactsMap.set(namePart, emailMatch[1]);
      } else {
        if (!conv.name.includes("Support") && !conv.name.includes("Deal")) {
          const nameMatch = conv.name.match(/Invitation for\s+(.+)$/i) || [null, conv.name];
          const potentialName = (nameMatch[1] || conv.name).trim();
          const matchedUser = await prisma.user.findFirst({
            where: { fullName: potentialName, role: "freelancer" },
            select: { fullName: true, email: true }
          });
          if (matchedUser) {
            contactsMap.set(matchedUser.fullName, matchedUser.email);
          }
        }
      }
    }

    const persons = Array.from(contactsMap.entries()).map(([name, email]) => ({ name, email }));

    res.json({ success: true, rows, total: rows.length, persons });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createClientMeeting = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const meeting = await createMeetingForUser(user, req.body || {}, "founder");
    res.status(201).json({ success: true, message: "Meeting scheduled", data: meeting });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// MESSAGES
// ==========================================

export const listClientMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
    if (conversationId) {
      const rows = await listMessagesForConversation(
        { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
        conversationId,
      );
      return res.json({ success: true, rows, total: rows.length });
    }

    const rows = await listConversationsForUser({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createClientMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const body = req.body || {};
    const result = await createMessageForUser(
      { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
      { conversationId: body.conversationId, content: body.content, title: body.title, recipientId: body.recipientId },
    );
    res.status(201).json({ success: true, message: "Message sent", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// WALLET
// ==========================================

export const getClientWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const data = await getUserWalletPayload(userId);
    res.json({ success: true, data });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const fundClientWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const result = await creditWalletForSelf(userId, Number(body.amount), "promotional", body.description || "Wallet top-up");
    res.status(201).json({ success: true, message: "Wallet funded", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const withdrawClientWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const amount = Number(body.amount);
    if (!amount || amount < 1000) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal amount is ₹1,000" });
    }
    const result = await debitWalletForSelf(userId, amount, "debit", body.description || "Wallet withdrawal");
    res.status(201).json({ success: true, message: "Withdrawal successful", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// INVOICES / PAYMENTS
// ==========================================

export const listClientInvoices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await listInvoicesForUser(userId);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listClientPayments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await prisma.payment.findMany({
      where: { userId },
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// REVIEWS
// ==========================================

export const listClientReviews = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await prisma.review.findMany({
      where: { reviewerId: userId },
      include: { reviewee: { select: { fullName: true, avatarUrl: true } }, project: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createClientReview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const projectId = String(body.projectId || "").trim();
    const revieweeId = String(body.revieweeId || body.freelancerId || "").trim();
    const rating = Number(body.rating);
    if (!projectId || !revieweeId || !Number.isFinite(rating)) {
      return res.status(400).json({ success: false, message: "projectId, revieweeId and rating are required" });
    }

    const project = await findOwnedProject(userId, projectId);
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const review = await prisma.review.create({
      data: {
        projectId,
        reviewerId: userId,
        revieweeId,
        rating,
        comment: body.comment ? String(body.comment) : null,
      },
    });

    res.status(201).json({ success: true, message: "Review submitted", data: review });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// ANALYTICS
// ==========================================

export const getClientAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const projWhere = clientProjectWhere(user, user.clientProfile);
    const [byStatus, contractsActive, contractsCompleted, reviews] = await Promise.all([
      prisma.project.groupBy({ by: ["status"], where: projWhere, _count: true }),
      prisma.contract.count({ where: { clientId: userId, status: { in: ["active", "pending_acceptance"] } } }),
      prisma.contract.count({ where: { clientId: userId, status: "completed" } }),
      prisma.review.findMany({ where: { reviewerId: userId }, select: { rating: true } }),
    ]);

    const avgRatingGiven = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length) * 100) / 100
      : 0;

    res.json({
      success: true,
      data: {
        projectsByStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
        contractsActive,
        contractsCompleted,
        avgRatingGiven,
        totalSpend: Number(user.clientProfile?.totalSpend ?? 0),
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// NOTIFICATIONS
// ==========================================

export const listClientNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    const data = await listUserNotifications(userId, "client", req.query as Record<string, unknown>);
    res.json({
      success: true,
      data: data.items,
      items: data.items,
      filters: data.filters,
      unreadCount: data.unreadCount,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const markClientNotificationRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const updated = await markNotificationRead(userId, "client", req.params.id);
    if (!updated) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const markAllClientNotificationsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const count = await markAllNotificationsRead(userId, "client");
    res.json({ success: true, message: "All notifications marked as read", data: { updated: count } });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// SETTINGS
// ==========================================

export const getClientSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

export const updateClientSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
// SUBSCRIPTIONS
// ==========================================

export const listClientSubscriptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await listSubscriptionsForUser(userId);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const purchaseClientSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
// DOCUMENTS / TEAM (settings-backed JSON lists)
// ==========================================

export const listClientDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "documents", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const addClientDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    if (!body.name && !body.url) {
      return res.status(400).json({ success: false, message: "name or url is required" });
    }
    const rows = await getJsonSetting(userId, "documents", [] as any[]);
    const doc = {
      id: `DOC-${Date.now().toString(36).toUpperCase()}`,
      name: body.name || "Untitled document",
      url: body.url || "",
      type: body.type || "file",
      createdAt: new Date().toISOString(),
    };
    const next = [doc, ...rows];
    await setJsonSetting(userId, "documents", next);
    res.status(201).json({ success: true, message: "Document added", data: doc, rows: next });
  } catch (err) {
    handleError(err, res, next);
  }
};
export const deleteClientDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "id is required" });

    const rows = await getJsonSetting(userId, "documents", [] as any[]);
    const nextRows = rows.filter((r: any) => r.id !== id);
    await setJsonSetting(userId, "documents", nextRows);
    res.json({ success: true, message: "Document removed", rows: nextRows });
  } catch (err) {
    handleError(err, res, next);
  }
};
export const listClientTeam = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "team", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listClientInvitations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    
    // 1. Get manual team invites
    const manualInvites = await getJsonSetting(userId, "team", [] as any[]);
    
    // 2. Get project invites from Conversations
    const user = await loadClientUser(userId);
    let projectInvites: any[] = [];
    if (user) {
      const conversations = await listConversationsForUser({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
      const inviteConvs = conversations.filter(c => c.name && c.name.startsWith("Project Invitation"));
      
      projectInvites = inviteConvs.map(c => ({
        id: c.id,
        name: c.name.replace("Project Invitation for ", "").replace("Project Invitation", "").trim() || "Freelancer",
        email: "",
        role: "Freelancer",
        department: "Project Invite",
        status: c.status === "active" ? "Pending" : c.status,
        createdAt: c.createdAt.toISOString()
      }));
    }

    const combined = [...projectInvites, ...manualInvites];
    // Sort by descending date
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ success: true, rows: combined, total: combined.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const addClientTeamMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "name is required" });

    const rows = await getJsonSetting(userId, "team", [] as any[]);
    const member = {
      id: `TM-${Date.now().toString(36).toUpperCase()}`,
      name,
      email: body.email || "",
      role: body.role || "Member",
      dept: body.dept || "Engineering",
      status: "Invited",
      createdAt: new Date().toISOString(),
    };
    const nextRows = [member, ...rows];
    await setJsonSetting(userId, "team", nextRows);

    // Get current client user details
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const clientName = user?.fullName || "A client";

    // Trigger Notifications
    try {
      const { NotificationService } = await import("../../modules/notifications/notification.service.js");
      
      // 1) Notify the inviting client (in-app)
      await NotificationService.enqueue({
        userId: userId,
        role: "client",
        type: "team",
        title: "Team Invitation Sent",
        message: `Invitation email sent to ${member.email} for the role of ${member.role} (${member.dept}).`,
        channel: "in_app"
      });

      // 2) Send invite email to the new member
      if (member.email) {
        await NotificationService.enqueue({
          type: "team",
          title: `Invitation to join ${clientName}'s Team on Go Experts`,
          message: `Hi ${member.name},\n\nYou have been invited by ${clientName} to join their team as a ${member.role} in the ${member.dept} department.\n\nClick here to accept the invitation and join: ${process.env.CLIENT_URL || "https://goexperts.in"}/business/team-access\n\nBest regards,\nGo Experts Team`,
          channel: "email",
          metadata: { toEmail: member.email }
        });
      }
    } catch (notifErr) {
      console.error("Failed to enqueue team invitation notifications:", notifErr);
    }

    res.status(201).json({ success: true, message: "Team member added", data: member, rows: nextRows });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const deleteClientTeamMember = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "id is required" });

    const rows = await getJsonSetting(userId, "team", [] as any[]);
    const nextRows = rows.filter((r: any) => r.id !== id);
    await setJsonSetting(userId, "team", nextRows);
    res.json({ success: true, message: "Team member removed", rows: nextRows });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listClientPipeline = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const projects = await prisma.project.findMany({
      where: clientProjectWhere(user, user.clientProfile),
      orderBy: { updatedAt: "desc" },
      include: { proposals: { select: { id: true, status: true } } },
    });

    const stages = ["draft", "open", "in_progress", "completed", "cancelled"];
    const pipeline = stages.map((status) => {
      const items = projects.filter((p) => String(p.status || "").toLowerCase() === status);
      return {
        stage: status,
        count: items.length,
        value: items.reduce((s, p) => s + Number(p.budget || 0), 0),
        projects: items,
      };
    });

    res.json({ success: true, data: { pipeline, projects } });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getClientReferrals = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: { referee: { select: { fullName: true, email: true } }, rewards: true },
      orderBy: { createdAt: "desc" },
    }).catch(() => []);
    const stored = await getJsonSetting(userId, "referrals", {
      code: `GE-C-${userId.slice(0, 6).toUpperCase()}`,
      leaderboard: [],
    });
    res.json({
      success: true,
      data: {
        code: (stored as any).code,
        rows: referrals.map((r: any) => ({
          id: r.id,
          name: r.referee?.fullName,
          email: r.referee?.email,
          status: r.status,
          date: r.createdAt,
          reward: r.rewards?.[0]?.amount ?? 0,
        })),
        leaderboard: (stored as any).leaderboard || [],
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getClientReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadClientUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const [projects, contracts, payments, invoices] = await Promise.all([
      prisma.project.count({ where: clientProjectWhere(user, user.clientProfile) }),
      prisma.contract.count({ where: { clientId: userId, deletedAt: null } }),
      prisma.payment.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          projects,
          contracts,
          payments: payments.length,
          invoices: invoices.length,
          spend: payments.reduce((s, p) => s + Number(p.amount || 0), 0),
        },
        payments,
        invoices,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listClientApiKeys = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "apiKeys", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const generateClientApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const name = String(body.name || "Default Key").trim();
    const env = String(body.env || "Production").trim();
    const rows = await getJsonSetting(userId, "apiKeys", [] as any[]);
    const newKey = {
      id: `AK-${Date.now().toString(36).toUpperCase()}`,
      name,
      env,
      key: `ge_${env === "Production" ? "live" : "test"}_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
      status: "Verified",
      created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      last: "Never used",
      scopes: body.scopes || "All access",
    };
    const next = [newKey, ...rows];
    await setJsonSetting(userId, "apiKeys", next);
    res.status(201).json({ success: true, message: "API key generated", data: newKey, rows: next });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const revokeClientApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "id is required" });

    const rows = await getJsonSetting(userId, "apiKeys", [] as any[]);
    const nextRows = rows.filter((r: any) => r.id !== id);
    await setJsonSetting(userId, "apiKeys", nextRows);
    res.json({ success: true, message: "API key revoked", rows: nextRows });
  } catch (err) {
    handleError(err, res, next);
  }
};