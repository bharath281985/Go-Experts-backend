import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { requireCapability, ActionRequirementsError } from "../../services/mobile/profile-readiness.service.js";
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

async function loadInvestorUser(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { investorProfile: true },
  });
}

function investorNeedles(user: { fullName: string; email: string }, profile: { firm?: string | null } | null) {
  return [user.fullName, user.email, profile?.firm].map((v) => String(v || "").trim()).filter(Boolean);
}

function investorWhere(user: { fullName: string; email: string }, profile: { firm?: string | null } | null) {
  const needles = investorNeedles(user, profile);
  return {
    deletedAt: null,
    OR: needles.length ? needles.map((n) => ({ investor: { contains: n } })) : [{ investor: "__none__" }],
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

export const getInvestorDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const where = investorWhere(user, user.investorProfile);

    const [total, pending, accepted, wallet, recentInvestments, unreadNotifications] = await Promise.all([
      prisma.investment.count({ where }),
      prisma.investment.count({ where: { ...where, status: "Pending" } }),
      prisma.investment.count({ where: { ...where, status: { in: ["Accepted", "Completed"] } } }),
      getUserWalletPayload(userId),
      prisma.investment.findMany({ where, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.notification.count({
        where: {
          status: { notIn: ["cancelled", "draft"] },
          readAt: null,
          NOT: { status: "read" },
          OR: [{ userId }, { AND: [{ userId: null }, { role: "investor" }] }],
        },
      }),
    ]);

    const totalDeployed = recentInvestments.reduce((s, i) => s + Number(i.offer || 0), 0);

    res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          name: user.fullName,
          firstName: (user.fullName || "there").split(" ")[0],
          email: user.email,
          firm: user.investorProfile?.firm || null,
          avatar: user.avatarUrl || null,
        },
        counts: {
          notifications: unreadNotifications,
          investors: 0,
          founders: 0,
          meetings: 0,
          messages: 0,
        },
        kpis: [
          { key: "total", label: "Total Investments", value: String(total) },
          { key: "pending", label: "Pending Deals", value: String(pending) },
          { key: "accepted", label: "Accepted Deals", value: String(accepted) },
          { key: "deals", label: "Deals Closed", value: String(user.investorProfile?.deals ?? 0) },
          { key: "balance", label: "Wallet Balance", value: money(wallet.balance, wallet.currency) },
        ],
        recentInvestments,
        totalDeployed,
        wallet,
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// PROFILE
// ==========================================

export const getInvestorProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
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
        firm: user.investorProfile?.firm || "",
        ticketMin: user.investorProfile?.ticketMin ?? null,
        ticketMax: user.investorProfile?.ticketMax ?? null,
        focusAreas: user.investorProfile?.focusAreas || "",
        deals: user.investorProfile?.deals ?? 0,
        status: user.status,
        verified: Boolean(user.isVerified || user.verified),
        role: user.role,
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateInvestorProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const existing = await loadInvestorUser(userId);
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

    const focusAreas =
      body.focusAreas != null
        ? Array.isArray(body.focusAreas)
          ? body.focusAreas.join(", ")
          : String(body.focusAreas)
        : existing.investorProfile?.focusAreas ?? null;

    await prisma.investorProfile.upsert({
      where: { userId },
      update: {
        firm: body.firm != null ? String(body.firm).trim() || null : existing.investorProfile?.firm ?? null,
        ticketMin: body.ticketMin != null && body.ticketMin !== "" ? Number(body.ticketMin) : existing.investorProfile?.ticketMin ?? null,
        ticketMax: body.ticketMax != null && body.ticketMax !== "" ? Number(body.ticketMax) : existing.investorProfile?.ticketMax ?? null,
        focusAreas,
      },
      create: {
        userId,
        firm: body.firm != null ? String(body.firm).trim() || null : null,
        ticketMin: body.ticketMin != null && body.ticketMin !== "" ? Number(body.ticketMin) : null,
        ticketMax: body.ticketMax != null && body.ticketMax !== "" ? Number(body.ticketMax) : null,
        focusAreas,
      },
    });

    return getInvestorProfile(req, res, next);
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// WATCHLIST (settings-backed JSON)
// ==========================================

export const listWatchlist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "watchlist", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const addToWatchlist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const startupId = String(body.startupId || "").trim();
    let startupName = body.startupName ? String(body.startupName).trim() : "";

    if (startupId) {
      const startup = await prisma.startupIdea.findFirst({ where: { id: startupId, deletedAt: null } });
      if (!startup) return res.status(404).json({ success: false, message: "Startup not found" });
      startupName = startup.startup;
    }
    if (!startupName) return res.status(400).json({ success: false, message: "startupId or startupName is required" });

    const rows = await getJsonSetting(userId, "watchlist", [] as any[]);
    if (rows.some((r: any) => (startupId && r.startupId === startupId) || r.startupName === startupName)) {
      return res.status(409).json({ success: false, message: "Already in watchlist" });
    }

    const item = {
      id: `WL-${Date.now().toString(36).toUpperCase()}`,
      startupId: startupId || null,
      startupName,
      addedAt: new Date().toISOString(),
    };
    const next = [item, ...rows];
    await setJsonSetting(userId, "watchlist", next);
    res.status(201).json({ success: true, message: "Added to watchlist", data: item, rows: next });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const removeFromWatchlist = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "watchlist", [] as any[]);
    const next = rows.filter((r: any) => r.id !== req.params.id);
    if (next.length === rows.length) return res.status(404).json({ success: false, message: "Watchlist item not found" });
    await setJsonSetting(userId, "watchlist", next);
    res.json({ success: true, message: "Removed from watchlist", rows: next });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// PORTFOLIO / INVESTMENTS
// ==========================================

export const getInvestorPortfolio = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const where = { ...investorWhere(user, user.investorProfile), status: { in: ["Accepted", "Completed"] } };
    const rows = await prisma.investment.findMany({ where, orderBy: { createdAt: "desc" } });
    const totalDeployed = rows.reduce((s, r) => s + Number(r.offer || 0), 0);
    const avgEquity = rows.length ? rows.reduce((s, r) => s + Number(r.equity || 0), 0) / rows.length : 0;

    res.json({ success: true, rows, total: rows.length, totalDeployed, avgEquity });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const listInvestorInvestments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const where = investorWhere(user, user.investorProfile);
    const rows = await prisma.investment.findMany({ where, orderBy: { createdAt: "desc" } });
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createInvestorInvestment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    // Enforce capabilities
    try {
      await requireCapability({ userId, action: "expressInterest" });
    } catch (err: any) {
      if (err instanceof ActionRequirementsError) {
        return res.status(403).json({
          success: false,
          code: err.code,
          action: err.action,
          message: err.message,
          missing: err.missing,
        });
      }
      throw err;
    }

    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const body = req.body || {};
    const startup = String(body.startup || "").trim();
    const offer = Number(body.offer);
    const equity = Number(body.equity);
    if (!startup || !Number.isFinite(offer) || !Number.isFinite(equity)) {
      return res.status(400).json({ success: false, message: "startup, offer and equity are required" });
    }

    const investment = await prisma.investment.create({
      data: {
        investor: user.fullName,
        startup,
        offer,
        equity,
        meetingDate: body.meetingDate ? String(body.meetingDate) : null,
        docs: body.docs ? String(body.docs) : undefined,
        status: body.status ? String(body.status) : "Pending",
      },
    });

    const founderName = String(body.founderName || "").trim();
    if (founderName) {
      try {
        const founderUser = await prisma.user.findFirst({ where: { fullName: founderName, deletedAt: null } });
        if (founderUser) {
          const { NotificationService } = await import("../../modules/notifications/notification.service.js");
          
          // 1) Send in-app notification
          await NotificationService.enqueue({
            userId: founderUser.id,
            role: founderUser.role,
            type: "investment",
            title: `New Investment Interest`,
            message: `${user.fullName} has expressed interest in ${startup} (Offer: $${offer}, Equity: ${equity}%).`,
            channel: "in_app",
            metadata: { investmentId: investment.id }
          });

          // 2) Send chat message
          await createMessageForUser(
            { id: user.id, fullName: user.fullName, email: user.email, role: user.role || "investor" },
            {
              title: `Investment Interest: ${startup}`,
              content: `Hi ${founderUser.fullName}, I have expressed interest in ${startup}. I'm open to discussing an offer of $${offer} for ${equity}% equity. Looking forward to connecting!`,
              recipientId: founderUser.id
            }
          );
        }
      } catch (notifErr) {
        console.error("Failed to trigger investment notification and message actions:", notifErr);
      }
    }

    res.status(201).json({ success: true, message: "Investment offer created", data: investment });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// MEETINGS
// ==========================================

export const listInvestorMeetings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const rows = await listMeetingsForUser(user, [user.investorProfile?.firm]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const createInvestorMeeting = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const meeting = await createMeetingForUser(user, req.body || {}, "investor");
    res.status(201).json({ success: true, message: "Meeting scheduled", data: meeting });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// MESSAGES
// ==========================================

export const listInvestorMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
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

export const createInvestorMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
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
// WALLET
// ==========================================

export const getInvestorWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const data = await getUserWalletPayload(userId);
    res.json({ success: true, data });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const depositInvestorWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const result = await creditWalletForSelf(userId, Number(body.amount), "promotional", body.description || "Wallet deposit");
    res.status(201).json({ success: true, message: "Wallet deposit successful", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const withdrawInvestorWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = req.body || {};
    const result = await debitWalletForSelf(userId, Number(body.amount), "withdrawal", body.description || "Wallet withdrawal", "pending");
    res.status(201).json({ success: true, message: "Withdrawal request submitted", data: result });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// INVOICES
// ==========================================

export const listInvestorInvoices = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
// ANALYTICS / REPORTS
// ==========================================

export const getInvestorAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const where = investorWhere(user, user.investorProfile);
    const [byStatus, rows] = await Promise.all([
      prisma.investment.groupBy({ by: ["status"], where, _count: true }),
      prisma.investment.findMany({ where }),
    ]);

    const totalDeployed = rows.reduce((s, r) => s + Number(r.offer || 0), 0);
    const avgTicket = rows.length ? totalDeployed / rows.length : 0;

    res.json({
      success: true,
      data: {
        investmentsByStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
        totalDeployed,
        avgTicket,
        totalDeals: rows.length,
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const getInvestorReports = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const user = await loadInvestorUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const where = investorWhere(user, user.investorProfile);
    const rows = await prisma.investment.findMany({ where, orderBy: { createdAt: "desc" } });

    const now = new Date();
    const months: { key: string; month: string; deployed: number; deals: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        month: d.toLocaleString("en-US", { month: "short" }),
        deployed: 0,
        deals: 0,
      });
    }
    for (const r of rows) {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) {
        bucket.deployed += Number(r.offer || 0);
        bucket.deals += 1;
      }
    }

    res.json({ success: true, data: { series: months, totalDeals: rows.length } });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// NOTIFICATIONS
// ==========================================

export const listInvestorNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const data = await listUserNotifications(userId, "investor", req.query as Record<string, unknown>);
    res.json({
      success: true,
      data: data.items,
      items: data.items,
      filters: data.filters,
      unreadCount: data.unreadCount,
      importantCount: data.importantCount,
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
    });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const markInvestorNotificationRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const updated = await markNotificationRead(userId, "investor", req.params.id);
    if (!updated) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, data: updated });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const markAllInvestorNotificationsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const count = await markAllNotificationsRead(userId, "investor");
    res.json({ success: true, message: "All notifications marked as read", data: { updated: count } });
  } catch (err) {
    handleError(err, res, next);
  }
};

// ==========================================
// DOCUMENTS
// ==========================================

export const listInvestorDocuments = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await getJsonSetting(userId, "documents", [] as any[]);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const addInvestorDocument = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// ==========================================
// SUBSCRIPTION
// ==========================================

export const listInvestorSubscriptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const rows = await listSubscriptionsForUser(userId);
    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const purchaseInvestorSubscription = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
// SETTINGS
// ==========================================

export const getInvestorSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const data = await getJsonSetting(userId, "settings", {
      emailNotifications: true,
      pushNotifications: true,
      dealAlerts: true,
      language: "en",
      timezone: "UTC",
    });
    res.json({ success: true, data });
  } catch (err) {
    handleError(err, res, next);
  }
};

export const updateInvestorSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

export const listAllFounders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const users = await prisma.user.findMany({
      where: { role: { in: ["founder", "Founder"] }, deletedAt: null },
      include: { founderProfile: true },
    });

    const rows = users.map((u) => ({
      name: u.fullName,
      userId: u.id,
      email: u.email,
      firm: u.founderProfile?.startupName || null,
    }));

    res.json({ success: true, rows, total: rows.length });
  } catch (err) {
    handleError(err, res, next);
  }
};


export const listInvestorReviews = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    next(err);
  }
};
