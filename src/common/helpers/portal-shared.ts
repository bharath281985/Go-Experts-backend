import { prisma } from "../../config/database.js";

export type PortalUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export class HttpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ==========================================
// GENERIC HELPERS
// ==========================================

export function relativeTime(date: Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function money(n: number, currency = "INR") {
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "INR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString("en-US")}`;
  }
}

function userNeedles(user: Pick<PortalUser, "fullName" | "email">, extra: Array<string | null | undefined> = []) {
  return [user.fullName, user.email, ...extra].map((v) => String(v || "").trim()).filter(Boolean);
}

// ==========================================
// WALLET
// ==========================================

export async function getOrCreateWallet(userId: string, currency = "INR") {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId, balance: 0, currency } });
  }
  return wallet;
}

function mapWalletTx(t: {
  id: string;
  type: string;
  amount: number;
  direction: string;
  description: string | null;
  balanceAfter: number;
  createdAt: Date;
}) {
  return {
    id: t.id,
    type: t.type,
    direction: t.direction,
    amount: Number(t.amount),
    credit: t.direction === "credit" ? Number(t.amount) : 0,
    debit: t.direction === "debit" ? Number(t.amount) : 0,
    description: t.description || "",
    balanceAfter: Number(t.balanceAfter),
    createdAt: t.createdAt,
    date: t.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  };
}

export async function getUserWalletPayload(userId: string) {
  const wallet = await getOrCreateWallet(userId);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const totalCredits = transactions
    .filter((t) => t.direction === "credit")
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalDebits = transactions
    .filter((t) => t.direction === "debit")
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  return {
    id: wallet.id,
    balance: Number(wallet.balance),
    available: Number(wallet.balance),
    currency: wallet.currency,
    totalEarnings: totalCredits,
    totalCredits,
    totalDebits,
    transactions: transactions.map(mapWalletTx),
  };
}

export async function creditWalletForSelf(userId: string, amount: number, type: string, description?: string) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new HttpError("A valid positive amount is required");

  return prisma.$transaction(async (tx) => {
    let wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await tx.wallet.create({ data: { userId, balance: 0, currency: "INR" } });
    }
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amt } },
    });
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount: amt,
        direction: "credit",
        description: description || `${type} credit`,
        balanceAfter: updated.balance,
      },
    });

    try {
      await tx.notification.create({
        data: {
          userId,
          type: "wallet",
          title: "Wallet Credited",
          message: `Your wallet has been credited with ₹${amt.toLocaleString()} by Super Admin.`,
          channel: "in_app",
          priority: "high",
          status: "unread",
        },
      });
    } catch {
      // ignore notification error
    }

    return { wallet: updated, transaction };
  });
}

export async function debitWalletForSelf(userId: string, amount: number, type: string, description?: string) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new HttpError("A valid positive amount is required");

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) < amt) {
      throw new HttpError("Insufficient wallet balance");
    }
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amt } },
    });
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount: amt,
        direction: "debit",
        description: description || `${type} debit`,
        balanceAfter: updated.balance,
      },
    });

    try {
      await tx.notification.create({
        data: {
          userId,
          type: "wallet",
          title: "Wallet Debited / Withdrawal Requested",
          message: `Your wallet transaction of ₹${amt.toLocaleString()} has been processed.`,
          channel: "in_app",
          priority: "high",
          status: "unread",
        },
      });
    } catch {}

    return { wallet: updated, transaction };
  });
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export function portalNotifScope(userId: string, role: string) {
  return {
    status: { notIn: ["cancelled", "draft"] },
    OR: [
      { userId },
      { AND: [{ userId: null }, { role }] },
      { AND: [{ userId: null }, { OR: [{ role: null }, { role: "" }] }] },
    ],
  };
}

function isNotifUnread(n: { readAt: Date | null; status: string }) {
  return !n.readAt && String(n.status || "").toLowerCase() !== "read";
}

function titleCaseType(type: string) {
  return String(type || "system")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapNotifRow(n: any) {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    priority: n.priority,
    channel: n.channel,
    status: n.status,
    read: !isNotifUnread(n),
    important: ["high", "urgent"].includes(String(n.priority || "").toLowerCase()),
    createdAt: n.createdAt,
    time: relativeTime(n.createdAt),
  };
}

export async function listUserNotifications(
  userId: string,
  role: string,
  query: Record<string, unknown>,
) {
  const filter = String(query.filter || "all").toLowerCase();
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));

  const rows = await prisma.notification.findMany({
    where: portalNotifScope(userId, role),
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const mapped = rows.map(mapNotifRow);
  const typeCounts = new Map<string, number>();
  for (const n of mapped) {
    const key = String(n.type || "system").toLowerCase();
    typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
  }

  const unreadCount = mapped.filter((n) => !n.read).length;
  const importantCount = mapped.filter((n) => n.important).length;
  const readCount = mapped.filter((n) => n.read).length;

  let filtered = mapped;
  if (filter === "unread") filtered = mapped.filter((n) => !n.read);
  else if (filter === "read") filtered = mapped.filter((n) => n.read);
  else if (filter === "important") filtered = mapped.filter((n) => n.important);
  else if (filter.startsWith("type:")) {
    const t = filter.slice(5);
    filtered = mapped.filter((n) => String(n.type || "").toLowerCase() === t);
  } else if (filter !== "all") {
    filtered = mapped.filter((n) => String(n.type || "").toLowerCase().includes(filter));
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const filters = [
    { key: "all", label: "All", count: mapped.length },
    { key: "unread", label: "Unread", count: unreadCount },
    { key: "read", label: "Read", count: readCount },
    { key: "important", label: "Important", count: importantCount },
    ...[...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key: `type:${key}`, label: titleCaseType(key), count })),
  ];

  return { items, filters, filter, unreadCount, importantCount, total, page, pageSize };
}

export async function markNotificationRead(userId: string, role: string, id: string) {
  const existing = await prisma.notification.findFirst({
    where: { id, ...portalNotifScope(userId, role) },
  });
  if (!existing) return null;
  const updated = await prisma.notification.update({
    where: { id },
    data: { status: "read", readAt: new Date() },
  });
  return mapNotifRow(updated);
}

export async function markAllNotificationsRead(userId: string, role: string) {
  const result = await prisma.notification.updateMany({
    where: {
      ...portalNotifScope(userId, role),
      readAt: null,
      NOT: { status: "read" },
    },
    data: { status: "read", readAt: new Date() },
  });
  return result.count;
}

// ==========================================
// INVOICES
// ==========================================

export async function listInvoicesForUser(userId: string) {
  const rows = await prisma.invoice.findMany({
    where: { userId },
    include: { items: true, subscription: { include: { plan: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    subtotal: Number(inv.subtotal),
    gst: Number(inv.gst),
    discount: Number(inv.discount),
    total: Number(inv.total),
    status: inv.status,
    plan: inv.subscription?.plan?.name || null,
    items: inv.items.map((it) => ({
      id: it.id,
      description: it.description,
      amount: Number(it.amount),
      tax: Number(it.tax),
    })),
    createdAt: inv.createdAt,
  }));
}

// ==========================================
// MEETINGS
// ==========================================

export async function listMeetingsForUser(
  user: Pick<PortalUser, "fullName" | "email">,
  extraNeedles: Array<string | null | undefined> = [],
) {
  const needles = userNeedles(user, extraNeedles);
  if (!needles.length) return [];
  const rows = await prisma.meeting.findMany({
    where: {
      deletedAt: null,
      OR: needles.flatMap((n) => [{ founder: { contains: n } }, { investor: { contains: n } }]),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function createMeetingForUser(
  user: PortalUser,
  body: any,
  selfSide: "founder" | "investor",
) {
  const counterpart = String(body.with || body.counterpart || body.withName || body.participant || "TBD").trim() || "TBD";
  const date = String(body.date || "").trim();
  const time = String(body.time || "").trim();
  if (!date || !time) throw new HttpError("date and time are required");

  const data: any = {
    date,
    time,
    mode: body.mode ? String(body.mode) : "Online",
    status: body.status ? String(body.status) : "Scheduled",
  };
  if (selfSide === "investor") {
    data.investor = user.fullName;
    data.founder = counterpart;
  } else {
    data.founder = user.fullName;
    data.investor = counterpart;
  }
  const meeting = await prisma.meeting.create({ data });
  if (body.email || counterpart !== "TBD") {
    try {
      let recipient = null;
      if (body.email) {
        recipient = await prisma.user.findFirst({ where: { email: body.email } });
      } else {
        recipient = await prisma.user.findFirst({ where: { fullName: counterpart, deletedAt: null } });
      }

      const { NotificationService } = await import("../../modules/notifications/notification.service.js");
      
      if (recipient) {
        // 1) Send in-app notification
        await NotificationService.enqueue({
          userId: recipient.id,
          role: recipient.role,
          type: "meeting",
          title: `New Meeting Scheduled`,
          message: `A meeting "${body.title || 'Meeting'}" has been scheduled with ${user.fullName} on ${date} at ${time}.`,
          channel: "in_app",
          metadata: { meetingId: meeting.id }
        });

        // 2) Send chat message to counterpart
        await createMessageForUser(
          { id: user.id, fullName: user.fullName, email: user.email, role: user.role || "client" },
          {
            title: `Meeting Scheduled: ${body.title || 'Discussion'}`,
            content: `Hi ${recipient.fullName}, I have scheduled a meeting: "${body.title || 'Discussion'}" on ${date} at ${time} (${body.mode || 'Online'}).`,
            recipientId: recipient.id
          }
        );
      }

      // 3) Send email to the entered mail ID
      await NotificationService.enqueue({
        userId: recipient?.id || undefined,
        type: "meeting",
        title: `Meeting Scheduled: ${body.title || 'Discussion'}`,
        message: `Hi,\n\nA meeting has been scheduled with ${user.fullName} on ${date} at ${time}.\n\nMode: ${body.mode || 'Online'}\n\nBest regards,\nGo Experts Team`,
        channel: "email",
        metadata: { toEmail: body.email }
      });
    } catch (notifErr) {
      console.error("Failed to trigger meeting notification and message actions:", notifErr);
    }
  }
  return meeting;
}

// ==========================================
// SETTINGS (JSON blobs scoped per user)
// ==========================================

export function settingKey(userId: string, key: string) {
  return `portal:${userId}:${key}`;
}

export async function getJsonSetting<T = any>(userId: string, key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key: settingKey(userId, key) } });
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.value);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

export async function setJsonSetting(userId: string, key: string, value: unknown, category = "portal") {
  const k = settingKey(userId, key);
  try {
    let finalValue = value;
    if (Array.isArray(value) && value.length > 50) {
      finalValue = value.slice(-50);
    }
    const strVal = JSON.stringify(finalValue);
    await prisma.setting.upsert({
      where: { key: k },
      update: { value: strVal, category },
      create: { key: k, value: strVal, category },
    });
  } catch (err) {
    console.error(`[SETTING ERROR] Failed to save key ${k}:`, err);
  }
  return value;
}

// ==========================================
// CONVERSATIONS / MESSAGES
// ==========================================

const CONVERSATIONS_SETTING_KEY = "conversations";

export async function listConversationsForUser(user: PortalUser) {
  const storedIds = await getJsonSetting<string[]>(user.id, CONVERSATIONS_SETTING_KEY, []);
  
  // 1. Check ALL notifications for user for conversationId in metadata
  try {
    const notifs = await prisma.notification.findMany({
      where: { userId: user.id },
      select: { metadata: true, message: true, title: true },
    });
    for (const n of notifs) {
      if (n.metadata) {
        let metaObj: any = n.metadata;
        if (typeof metaObj === "string") {
          try { metaObj = JSON.parse(metaObj); } catch {}
        }
        if (metaObj && typeof metaObj === "object") {
          const cid = metaObj.conversationId || metaObj.convId;
          if (cid && typeof cid === "string" && !storedIds.includes(cid)) {
            storedIds.push(cid);
          }
        }
      }
    }
  } catch {}

  // 2. Check my sent/received messages
  const myMessages = await prisma.message.findMany({
    where: { from: user.id },
    select: { conversationId: true },
    distinct: ["conversationId"],
  }).catch(() => []);
  for (const m of myMessages) {
    if (m.conversationId && !storedIds.includes(m.conversationId)) {
      storedIds.push(m.conversationId);
    }
  }

  const needles = userNeedles(user);
  const or: any[] = needles.map((n) => ({ name: { contains: n } }));
  const orMsg: any[] = needles.map((n) => ({ msg: { contains: n } }));

  if (storedIds.length) {
    or.push({ id: { in: storedIds } });
  }

  // Fallback: If no stored IDs, fetch all active conversations
  const rows = await prisma.conversation.findMany({
    where: {
      deletedAt: null,
      OR: or.length ? [...or, ...orMsg] : undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  // Deduplicate conversations per person so each contact appears once in sidebar
  const uniqueMap = new Map<string, any>();
  for (const r of rows) {
    let nameKey = String(r.name || "").trim().toLowerCase();
    const match = `${r.name} ${r.msg}`.match(/(?:with|between|for|to|from)\s+([A-Za-z0-9\s]+?)(?:\s+&|\s+on|\s+at|\.|\(|$)/i);
    if (match && match[1] && match[1].trim().length > 2) {
      nameKey = match[1].trim().toLowerCase();
    }
    if (!uniqueMap.has(nameKey)) {
      uniqueMap.set(nameKey, r);
    }
  }
  return Array.from(uniqueMap.values());
}

async function userOwnsConversation(user: PortalUser, conversationId: string) {
  const storedIds = await getJsonSetting<string[]>(user.id, CONVERSATIONS_SETTING_KEY, []);
  if (storedIds.includes(conversationId)) return true;
  
  const msg = await prisma.message.findFirst({ where: { conversationId } }).catch(() => null);
  if (msg) return true;

  const needles = userNeedles(user);
  if (!needles.length) return false;
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, deletedAt: null, OR: needles.map((n) => ({ name: { contains: n } })) },
  });
  return Boolean(conv);
}

export async function listMessagesForConversation(user: PortalUser, conversationId: string) {
  const owns = await userOwnsConversation(user, conversationId);
  if (!owns) throw new HttpError("Conversation not found", 404);
  const rows = await prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  return rows.map(r => ({ ...r, from: r.from === user.id ? "me" : "them" }));
}

export async function createMessageForUser(
  user: PortalUser,
  { conversationId, content, title, recipientId }: { conversationId?: string; content: string; title?: string; recipientId?: string },
) {
  const text = String(content || "").trim();
  if (!text) throw new HttpError("Message content is required");

  let convId = conversationId;
  if (convId) {
    const owns = await userOwnsConversation(user, convId);
    if (!owns) throw new HttpError("Conversation not found", 404);
    try {
      const settings = await prisma.setting.findMany({
        where: {
          key: { startsWith: "portal:" },
          value: { contains: convId }
        }
      });
      const userIds = settings
        .map(s => {
          const parts = s.key.split(":");
          return parts[1];
        })
        .filter(id => id && id !== user.id);

      for (const targetId of userIds) {
        const dbUser = await prisma.user.findUnique({ where: { id: targetId } });
        if (dbUser) {
          const { NotificationService } = await import("../../modules/notifications/notification.service.js");
          await NotificationService.enqueue({
            userId: targetId,
            role: dbUser.role,
            type: "message",
            title: `New Message from ${user.fullName}`,
            message: text.length > 80 ? `${text.slice(0, 80)}...` : text,
            channel: "in_app",
            metadata: { conversationId: convId }
          });
        }
      }
    } catch (notifErr) {
      console.error("Failed to trigger message notification for existing conversation:", notifErr);
    }
  } else {
    let convName = title ? String(title) : `${user.fullName} (${user.email})`;
    let realRecipientId = recipientId;
    let dbUser: any = null;

    if (recipientId) {
      dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: recipientId },
            { email: recipientId },
            { fullName: recipientId },
            { referralCode: recipientId }
          ]
        }
      });
      if (dbUser) {
        realRecipientId = dbUser.id;
        convName = title
          ? `${title} - ${user.fullName} & ${dbUser.fullName}`
          : `Project Invitation between ${user.fullName} & ${dbUser.fullName}`;
      }
    }

    // Reuse existing conversation thread if one already exists between sender and recipient
    if (!convId && dbUser) {
      const userConvs = await getJsonSetting<string[]>(user.id, CONVERSATIONS_SETTING_KEY, []);
      const recipientConvs = await getJsonSetting<string[]>(dbUser.id, CONVERSATIONS_SETTING_KEY, []);
      const commonIds = userConvs.filter((id) => recipientConvs.includes(id));

      let existingConv: any = null;
      if (commonIds.length) {
        existingConv = await prisma.conversation.findFirst({
          where: { id: { in: commonIds }, deletedAt: null },
          orderBy: { updatedAt: "desc" },
        });
      }
      if (!existingConv && user.fullName && dbUser.fullName) {
        existingConv = await prisma.conversation.findFirst({
          where: {
            deletedAt: null,
            AND: [
              { OR: [{ name: { contains: user.fullName } }, { msg: { contains: user.fullName } }] },
              { OR: [{ name: { contains: dbUser.fullName } }, { msg: { contains: dbUser.fullName } }] }
            ]
          },
          orderBy: { updatedAt: "desc" }
        });
      }

      if (existingConv) {
        convId = existingConv.id;
      }
    }

    if (!convId) {
      const conv = await prisma.conversation.create({
        data: {
          name: convName,
          role: user.role,
          msg: text,
          time: "now",
          status: "active",
        },
      });
      convId = conv.id;
    }

    const storedIds = await getJsonSetting<string[]>(user.id, CONVERSATIONS_SETTING_KEY, []);
    if (!storedIds.includes(convId)) {
      await setJsonSetting(user.id, CONVERSATIONS_SETTING_KEY, [...storedIds, convId]);
    }
    
    if (recipientId) {
      if (dbUser) {
        const recipientIds = await getJsonSetting<string[]>(realRecipientId, CONVERSATIONS_SETTING_KEY, []);
        if (!recipientIds.includes(convId)) {
          await setJsonSetting(realRecipientId, CONVERSATIONS_SETTING_KEY, [...recipientIds, convId]);
        }
        try {
          const { NotificationService } = await import("../../modules/notifications/notification.service.js");
          await NotificationService.enqueue({
            userId: realRecipientId,
            role: dbUser.role,
            type: "message",
            title: `New Message from ${user.fullName}`,
            message: text.length > 80 ? `${text.slice(0, 80)}...` : text,
            channel: "in_app",
            metadata: { conversationId: convId }
          });
        } catch (notifErr) {
          console.error("Failed to trigger message notification:", notifErr);
        }
      } else {
        const recipientIds = await getJsonSetting<string[]>(recipientId, CONVERSATIONS_SETTING_KEY, []);
        if (!recipientIds.includes(convId)) {
          await setJsonSetting(recipientId, CONVERSATIONS_SETTING_KEY, [...recipientIds, convId]);
        }
      }
    }
  }

  const message = await prisma.message.create({
    data: { conversationId: convId, from: user.id, text, time: new Date().toLocaleTimeString() },
  });

  await prisma.conversation.update({
    where: { id: convId },
    data: { msg: text, time: "now" },
  });

  return { conversationId: convId, message };
}

// ==========================================
// PROFILE ENSURE HELPERS
// ==========================================

export async function ensureClientProfile(userId: string) {
  return prisma.clientProfile.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function ensureInvestorProfile(userId: string) {
  return prisma.investorProfile.upsert({ where: { userId }, update: {}, create: { userId } });
}

export async function ensureFounderProfile(userId: string) {
  return prisma.founderProfile.upsert({ where: { userId }, update: {}, create: { userId } });
}

// ==========================================
// SUBSCRIPTIONS (self-service, simplified from admin financials module)
// ==========================================

function generateInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${ts}-${rand}`;
}

function calcGST(amount: number) {
  return parseFloat((amount * 0.18).toFixed(2));
}

function addDuration(startDate: Date, duration: string) {
  const d = new Date(startDate);
  switch (duration) {
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export async function purchaseSubscriptionForSelf(
  userId: string,
  planId: string,
  gateway = "wallet",
  transactionId?: string,
) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.status !== "active") throw new HttpError("Plan not available", 404);

  return prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({ where: { userId, status: "active" }, data: { status: "expired" } });

    const gst = calcGST(plan.amount);
    const total = parseFloat((plan.amount + gst).toFixed(2));
    const now = new Date();
    const endDate = addDuration(now, plan.duration);

    const subscription = await tx.subscription.create({
      data: { userId, planId, status: "active", autoRenew: true, startDate: now, endDate },
    });

    const payment = await tx.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        amount: total,
        currency: plan.currency,
        gateway,
        transactionId: transactionId || `TXN-${Date.now()}`,
        status: "completed",
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        userId,
        subscriptionId: subscription.id,
        subtotal: plan.amount,
        gst,
        discount: 0,
        total,
        status: "paid",
      },
    });

    await tx.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        description: `${plan.name} Subscription (${plan.duration})`,
        amount: plan.amount,
        tax: gst,
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        userId,
        planId,
        action: "purchase",
        metadata: JSON.stringify({ paymentId: payment.id, invoiceId: invoice.id }),
      },
    });

    return { subscription, payment, invoice, plan };
  });
}

export async function listSubscriptionsForUser(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}
