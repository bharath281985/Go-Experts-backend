import { prisma } from "../../config/database.js";
export class HttpError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
    }
}
// ==========================================
// GENERIC HELPERS
// ==========================================
export function relativeTime(date) {
    const diffMs = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1)
        return "just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)
        return `${days}d ago`;
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export function money(n, currency = "INR") {
    const value = Number.isFinite(n) ? n : 0;
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency === "USD" ? "USD" : "INR",
            maximumFractionDigits: 0,
        }).format(value);
    }
    catch {
        return `${value.toLocaleString("en-US")}`;
    }
}
function userNeedles(user, extra = []) {
    return [user.fullName, user.email, ...extra].map((v) => String(v || "").trim()).filter(Boolean);
}
// ==========================================
// WALLET
// ==========================================
export async function getOrCreateWallet(userId, currency = "INR") {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
        wallet = await prisma.wallet.create({ data: { userId, balance: 0, currency } });
    }
    return wallet;
}
function mapWalletTx(t) {
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
export async function getUserWalletPayload(userId) {
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
        currency: wallet.currency,
        totalCredits,
        totalDebits,
        transactions: transactions.map(mapWalletTx),
    };
}
export async function creditWalletForSelf(userId, amount, type, description) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0)
        throw new HttpError("A valid positive amount is required");
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
        return { wallet: updated, transaction };
    });
}
export async function debitWalletForSelf(userId, amount, type, description) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0)
        throw new HttpError("A valid positive amount is required");
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
        return { wallet: updated, transaction };
    });
}
// ==========================================
// NOTIFICATIONS
// ==========================================
export function portalNotifScope(userId, role) {
    return {
        status: { notIn: ["cancelled", "draft"] },
        OR: [
            { userId },
            { AND: [{ userId: null }, { role }] },
            { AND: [{ userId: null }, { OR: [{ role: null }, { role: "" }] }] },
        ],
    };
}
function isNotifUnread(n) {
    return !n.readAt && String(n.status || "").toLowerCase() !== "read";
}
function titleCaseType(type) {
    return String(type || "system")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
function mapNotifRow(n) {
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
export async function listUserNotifications(userId, role, query) {
    const filter = String(query.filter || "all").toLowerCase();
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
    const rows = await prisma.notification.findMany({
        where: portalNotifScope(userId, role),
        orderBy: { createdAt: "desc" },
        take: 500,
    });
    const mapped = rows.map(mapNotifRow);
    const typeCounts = new Map();
    for (const n of mapped) {
        const key = String(n.type || "system").toLowerCase();
        typeCounts.set(key, (typeCounts.get(key) || 0) + 1);
    }
    const unreadCount = mapped.filter((n) => !n.read).length;
    const importantCount = mapped.filter((n) => n.important).length;
    const readCount = mapped.filter((n) => n.read).length;
    let filtered = mapped;
    if (filter === "unread")
        filtered = mapped.filter((n) => !n.read);
    else if (filter === "read")
        filtered = mapped.filter((n) => n.read);
    else if (filter === "important")
        filtered = mapped.filter((n) => n.important);
    else if (filter.startsWith("type:")) {
        const t = filter.slice(5);
        filtered = mapped.filter((n) => String(n.type || "").toLowerCase() === t);
    }
    else if (filter !== "all") {
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
export async function markNotificationRead(userId, role, id) {
    const existing = await prisma.notification.findFirst({
        where: { id, ...portalNotifScope(userId, role) },
    });
    if (!existing)
        return null;
    const updated = await prisma.notification.update({
        where: { id },
        data: { status: "read", readAt: new Date() },
    });
    return mapNotifRow(updated);
}
export async function markAllNotificationsRead(userId, role) {
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
export async function listInvoicesForUser(userId) {
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
export async function listMeetingsForUser(user, extraNeedles = []) {
    const needles = userNeedles(user, extraNeedles);
    if (!needles.length)
        return [];
    const rows = await prisma.meeting.findMany({
        where: {
            deletedAt: null,
            OR: needles.flatMap((n) => [{ founder: { contains: n } }, { investor: { contains: n } }]),
        },
        orderBy: { createdAt: "desc" },
    });
    return rows;
}
export async function createMeetingForUser(user, body, selfSide) {
    const counterpart = String(body.with || body.counterpart || body.withName || body.participant || "TBD").trim() || "TBD";
    const date = String(body.date || "").trim();
    const time = String(body.time || "").trim();
    if (!date || !time)
        throw new HttpError("date and time are required");
    const data = {
        date,
        time,
        mode: body.mode ? String(body.mode) : "Online",
        status: body.status ? String(body.status) : "Scheduled",
    };
    if (selfSide === "investor") {
        data.investor = user.fullName;
        data.founder = counterpart;
    }
    else {
        data.founder = user.fullName;
        data.investor = counterpart;
    }
    return prisma.meeting.create({ data });
}
// ==========================================
// SETTINGS (JSON blobs scoped per user)
// ==========================================
export function settingKey(userId, key) {
    return `portal:${userId}:${key}`;
}
export async function getJsonSetting(userId, key, fallback) {
    const row = await prisma.setting.findUnique({ where: { key: settingKey(userId, key) } });
    if (!row)
        return fallback;
    try {
        const parsed = JSON.parse(row.value);
        return parsed == null ? fallback : parsed;
    }
    catch {
        return fallback;
    }
}
export async function setJsonSetting(userId, key, value, category = "portal") {
    const k = settingKey(userId, key);
    await prisma.setting.upsert({
        where: { key: k },
        update: { value: JSON.stringify(value), category },
        create: { key: k, value: JSON.stringify(value), category },
    });
    return value;
}
// ==========================================
// CONVERSATIONS / MESSAGES
// ==========================================
const CONVERSATIONS_SETTING_KEY = "conversations";
export async function listConversationsForUser(user) {
    const storedIds = await getJsonSetting(user.id, CONVERSATIONS_SETTING_KEY, []);
    const needles = userNeedles(user);
    const or = needles.map((n) => ({ name: { contains: n } }));
    if (storedIds.length)
        or.push({ id: { in: storedIds } });
    if (!or.length)
        return [];
    const rows = await prisma.conversation.findMany({
        where: { deletedAt: null, OR: or },
        orderBy: { updatedAt: "desc" },
    });
    return rows;
}
async function userOwnsConversation(user, conversationId) {
    const storedIds = await getJsonSetting(user.id, CONVERSATIONS_SETTING_KEY, []);
    if (storedIds.includes(conversationId))
        return true;
    const needles = userNeedles(user);
    if (!needles.length)
        return false;
    const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, deletedAt: null, OR: needles.map((n) => ({ name: { contains: n } })) },
    });
    return Boolean(conv);
}
export async function listMessagesForConversation(user, conversationId) {
    const owns = await userOwnsConversation(user, conversationId);
    if (!owns)
        throw new HttpError("Conversation not found", 404);
    return prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
}
export async function createMessageForUser(user, { conversationId, content, title }) {
    const text = String(content || "").trim();
    if (!text)
        throw new HttpError("Message content is required");
    let convId = conversationId;
    if (convId) {
        const owns = await userOwnsConversation(user, convId);
        if (!owns)
            throw new HttpError("Conversation not found", 404);
    }
    else {
        const conv = await prisma.conversation.create({
            data: {
                name: title ? String(title) : `${user.fullName} (${user.email})`,
                role: user.role,
                msg: text,
                time: "now",
                status: "active",
            },
        });
        convId = conv.id;
        const storedIds = await getJsonSetting(user.id, CONVERSATIONS_SETTING_KEY, []);
        await setJsonSetting(user.id, CONVERSATIONS_SETTING_KEY, [...storedIds, convId]);
    }
    const message = await prisma.message.create({
        data: { conversationId: convId, from: "me", text, time: new Date().toLocaleTimeString() },
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
export async function ensureClientProfile(userId) {
    return prisma.clientProfile.upsert({ where: { userId }, update: {}, create: { userId } });
}
export async function ensureInvestorProfile(userId) {
    return prisma.investorProfile.upsert({ where: { userId }, update: {}, create: { userId } });
}
export async function ensureFounderProfile(userId) {
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
function calcGST(amount) {
    return parseFloat((amount * 0.18).toFixed(2));
}
function addDuration(startDate, duration) {
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
export async function purchaseSubscriptionForSelf(userId, planId, gateway = "wallet", transactionId) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.status !== "active")
        throw new HttpError("Plan not available", 404);
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
export async function listSubscriptionsForUser(userId) {
    return prisma.subscription.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
    });
}
