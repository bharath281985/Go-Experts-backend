import { prisma } from "../../config/database.js";
import { HttpError, getUserWalletPayload, creditWalletForSelf, listInvoicesForUser, listMeetingsForUser, createMeetingForUser, listUserNotifications, markNotificationRead, markAllNotificationsRead, getJsonSetting, setJsonSetting, listConversationsForUser, listMessagesForConversation, createMessageForUser, purchaseSubscriptionForSelf, listSubscriptionsForUser, money, } from "../../common/helpers/portal-shared.js";
async function loadClientUser(userId) {
    const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: { clientProfile: true },
    });
    return user;
}
function clientNeedles(user, profile) {
    return [user.fullName, user.email, profile?.company]
        .map((v) => String(v || "").trim())
        .filter(Boolean);
}
function clientProjectWhere(user, profile) {
    const needles = clientNeedles(user, profile);
    return {
        deletedAt: null,
        OR: needles.length ? needles.map((n) => ({ client: { contains: n } })) : [{ client: "__none__" }],
    };
}
function handleError(err, res, next) {
    if (err instanceof HttpError) {
        return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
}
function requireUser(req, res) {
    if (!req.user?.id) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return null;
    }
    return req.user.id;
}
// ==========================================
// DASHBOARD
// ==========================================
export const getClientDashboard = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const projWhere = clientProjectWhere(user, user.clientProfile);
        const [projectsTotal, projectsOpen, projectsActive, projectsCompleted, contracts, invoices, wallet, unreadNotifications, recentProjects,] = await Promise.all([
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
                    firstName: (user.fullName || "there").split(" ")[0],
                    email: user.email,
                    company: user.clientProfile?.company || null,
                    industry: user.clientProfile?.industry || null,
                    avatar: user.avatarUrl || null,
                },
                kpis: [
                    { key: "projects", label: "Total Projects", value: String(projectsTotal) },
                    { key: "open", label: "Open Projects", value: String(projectsOpen) },
                    { key: "active", label: "Active Projects", value: String(projectsActive) },
                    { key: "completed", label: "Completed Projects", value: String(projectsCompleted) },
                    { key: "spend", label: "Total Spend", value: money(totalSpend) },
                    { key: "balance", label: "Wallet Balance", value: money(wallet.balance, wallet.currency) },
                ],
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
                counts: { notifications: unreadNotifications, projects: projectsTotal },
            },
        });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// PROFILE
// ==========================================
export const getClientProfile = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateClientProfile = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const existing = await loadClientUser(userId);
        if (!existing)
            return res.status(404).json({ success: false, message: "User not found" });
        const fullName = body.fullName != null ? String(body.fullName).trim() : existing.fullName;
        if (!fullName)
            return res.status(400).json({ success: false, message: "Full name is required" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// PROJECTS
// ==========================================
export const listClientProjects = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createClientProject = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const body = req.body || {};
        const title = String(body.title || "").trim();
        const budget = Number(body.budget);
        const category = String(body.category || "").trim();
        const technology = String(body.technology || "").trim();
        if (!title || !Number.isFinite(budget) || !category || !technology) {
            return res
                .status(400)
                .json({ success: false, message: "title, budget, category and technology are required" });
        }
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
async function findOwnedProject(userId, projectId) {
    const user = await loadClientUser(userId);
    if (!user)
        throw new HttpError("User not found", 404);
    const where = clientProjectWhere(user, user.clientProfile);
    const project = await prisma.project.findFirst({ where: { ...where, id: projectId } });
    return project;
}
export const getClientProject = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const project = await findOwnedProject(userId, req.params.id);
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateClientProject = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const project = await findOwnedProject(userId, req.params.id);
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });
        const body = req.body || {};
        const data = {};
        if (body.title != null)
            data.title = String(body.title).trim();
        if (body.budget != null && body.budget !== "")
            data.budget = Number(body.budget);
        if (body.category != null)
            data.category = String(body.category).trim();
        if (body.technology != null)
            data.technology = String(body.technology).trim();
        if (body.timeline != null)
            data.timeline = String(body.timeline).trim() || null;
        if (body.status != null)
            data.status = String(body.status).trim();
        if (body.freelancer != null)
            data.freelancer = String(body.freelancer).trim() || null;
        const updated = await prisma.project.update({ where: { id: project.id }, data });
        res.json({ success: true, message: "Project updated", data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const deleteClientProject = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const project = await findOwnedProject(userId, req.params.id);
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });
        await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } });
        res.json({ success: true, message: "Project deleted" });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listProjectApplications = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const project = await findOwnedProject(userId, req.params.id);
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });
        const rows = await prisma.proposal.findMany({
            where: { projectId: project.id, deletedAt: null },
            include: { freelancer: { select: { id: true, fullName: true, email: true, avatarUrl: true, bio: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
async function updateProposalStatusForClient(userId, proposalId, status) {
    const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, deletedAt: null } });
    if (!proposal)
        throw new HttpError("Proposal not found", 404);
    const project = await findOwnedProject(userId, proposal.projectId);
    if (!project)
        throw new HttpError("Proposal not found", 404);
    return prisma.proposal.update({ where: { id: proposalId }, data: { status } });
}
export const acceptProposal = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const updated = await updateProposalStatusForClient(userId, req.params.id, "accepted");
        res.json({ success: true, message: "Proposal accepted", data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const rejectProposal = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const updated = await updateProposalStatusForClient(userId, req.params.id, "rejected");
        res.json({ success: true, message: "Proposal rejected", data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const interviewProposal = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const updated = await updateProposalStatusForClient(userId, req.params.id, "interview");
        res.json({ success: true, message: "Proposal moved to interview", data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// CONTRACTS / TASKS
// ==========================================
export const listClientContracts = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.contract.findMany({
            where: { clientId: userId, deletedAt: null },
            include: { project: true, freelancer: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listClientTasks = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const projWhere = clientProjectWhere(user, user.clientProfile);
        const rows = await prisma.task.findMany({
            where: { deletedAt: null, project: { is: projWhere } },
            include: { project: { select: { id: true, title: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// MEETINGS
// ==========================================
export const listClientMeetings = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const rows = await listMeetingsForUser(user, [user.clientProfile?.company]);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createClientMeeting = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const meeting = await createMeetingForUser(user, req.body || {}, "founder");
        res.status(201).json({ success: true, message: "Meeting scheduled", data: meeting });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// MESSAGES
// ==========================================
export const listClientMessages = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
        if (conversationId) {
            const rows = await listMessagesForConversation({ id: user.id, fullName: user.fullName, email: user.email, role: user.role }, conversationId);
            return res.json({ success: true, rows, total: rows.length });
        }
        const rows = await listConversationsForUser({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createClientMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const body = req.body || {};
        const result = await createMessageForUser({ id: user.id, fullName: user.fullName, email: user.email, role: user.role }, { conversationId: body.conversationId, content: body.content, title: body.title });
        res.status(201).json({ success: true, message: "Message sent", data: result });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// WALLET
// ==========================================
export const getClientWallet = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const data = await getUserWalletPayload(userId);
        res.json({ success: true, data });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const fundClientWallet = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const result = await creditWalletForSelf(userId, Number(body.amount), "promotional", body.description || "Wallet top-up");
        res.status(201).json({ success: true, message: "Wallet funded", data: result });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// INVOICES / PAYMENTS
// ==========================================
export const listClientInvoices = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await listInvoicesForUser(userId);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listClientPayments = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.payment.findMany({
            where: { userId },
            include: { subscription: { include: { plan: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// REVIEWS
// ==========================================
export const listClientReviews = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.review.findMany({
            where: { reviewerId: userId },
            include: { reviewee: { select: { fullName: true, avatarUrl: true } }, project: { select: { title: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createClientReview = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const projectId = String(body.projectId || "").trim();
        const revieweeId = String(body.revieweeId || body.freelancerId || "").trim();
        const rating = Number(body.rating);
        if (!projectId || !revieweeId || !Number.isFinite(rating)) {
            return res.status(400).json({ success: false, message: "projectId, revieweeId and rating are required" });
        }
        const project = await findOwnedProject(userId, projectId);
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// ANALYTICS
// ==========================================
export const getClientAnalytics = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// NOTIFICATIONS
// ==========================================
export const listClientNotifications = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const data = await listUserNotifications(userId, "client", req.query);
        res.json({ success: true, data });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const markClientNotificationRead = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const updated = await markNotificationRead(userId, "client", req.params.id);
        if (!updated)
            return res.status(404).json({ success: false, message: "Notification not found" });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const markAllClientNotificationsRead = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const count = await markAllNotificationsRead(userId, "client");
        res.json({ success: true, message: "All notifications marked as read", data: { updated: count } });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// SETTINGS
// ==========================================
export const getClientSettings = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const data = await getJsonSetting(userId, "settings", {
            emailNotifications: true,
            pushNotifications: true,
            smsNotifications: false,
            language: "en",
            timezone: "UTC",
        });
        res.json({ success: true, data });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateClientSettings = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const existing = await getJsonSetting(userId, "settings", {});
        const merged = { ...existing, ...(req.body || {}) };
        await setJsonSetting(userId, "settings", merged);
        res.json({ success: true, message: "Settings updated", data: merged });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// SUBSCRIPTIONS
// ==========================================
export const listClientSubscriptions = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await listSubscriptionsForUser(userId);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const purchaseClientSubscription = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const planId = String(body.planId || "").trim();
        if (!planId)
            return res.status(400).json({ success: false, message: "planId is required" });
        const result = await purchaseSubscriptionForSelf(userId, planId, body.gateway, body.transactionId);
        res.status(201).json({ success: true, message: "Subscription purchased", data: result });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// DOCUMENTS / TEAM (settings-backed JSON lists)
// ==========================================
export const listClientDocuments = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await getJsonSetting(userId, "documents", []);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const addClientDocument = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        if (!body.name && !body.url) {
            return res.status(400).json({ success: false, message: "name or url is required" });
        }
        const rows = await getJsonSetting(userId, "documents", []);
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listClientTeam = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await getJsonSetting(userId, "team", []);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const addClientTeamMember = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const name = String(body.name || "").trim();
        if (!name)
            return res.status(400).json({ success: false, message: "name is required" });
        const rows = await getJsonSetting(userId, "team", []);
        const member = {
            id: `TM-${Date.now().toString(36).toUpperCase()}`,
            name,
            email: body.email || "",
            role: body.role || "Member",
            createdAt: new Date().toISOString(),
        };
        const next = [member, ...rows];
        await setJsonSetting(userId, "team", next);
        res.status(201).json({ success: true, message: "Team member added", data: member, rows: next });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listClientPipeline = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getClientReferrals = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
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
                code: stored.code,
                rows: referrals.map((r) => ({
                    id: r.id,
                    name: r.referee?.fullName,
                    email: r.referee?.email,
                    status: r.status,
                    date: r.createdAt,
                    reward: r.rewards?.[0]?.amount ?? 0,
                })),
                leaderboard: stored.leaderboard || [],
            },
        });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getClientReports = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadClientUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
