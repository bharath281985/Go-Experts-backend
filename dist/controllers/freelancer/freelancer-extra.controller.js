import { prisma } from "../../config/database.js";
import { HttpError, debitWalletForSelf, listInvoicesForUser, listMeetingsForUser, getJsonSetting, setJsonSetting, listConversationsForUser, listMessagesForConversation, createMessageForUser, purchaseSubscriptionForSelf, listSubscriptionsForUser, getUserWalletPayload, } from "../../common/helpers/portal-shared.js";
import { FREELANCER_PROFILE_LIST_SELECT } from "../../common/helpers/prisma-compat.js";
async function loadFreelancerUser(userId) {
    return prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: { freelancerProfile: { select: FREELANCER_PROFILE_LIST_SELECT } },
    });
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
export const getFreelancerWallet = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const walletData = await getUserWalletPayload(userId);
        res.json({ success: true, data: walletData });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
function freelancerNeedles(user) {
    return [user.fullName, user.email].map((v) => String(v || "").trim()).filter(Boolean);
}
// ==========================================
// PROPOSALS
// ==========================================
export const listFreelancerProposals = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.proposal.findMany({
            where: { freelancerId: userId, deletedAt: null },
            include: { project: true },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createFreelancerProposal = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const projectId = String(body.projectId || "").trim();
        const bidAmount = Number(body.bidAmount);
        if (!projectId || !Number.isFinite(bidAmount)) {
            return res.status(400).json({ success: false, message: "projectId and bidAmount are required" });
        }
        const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });
        const existing = await prisma.proposal.findFirst({
            where: { projectId, freelancerId: userId, deletedAt: null, status: { notIn: ["withdrawn", "rejected"] } },
        });
        if (existing)
            return res.status(409).json({ success: false, message: "You already applied to this project" });
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const withdrawFreelancerProposal = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const proposal = await prisma.proposal.findFirst({
            where: { id: req.params.id, freelancerId: userId, deletedAt: null },
        });
        if (!proposal)
            return res.status(404).json({ success: false, message: "Proposal not found" });
        const updated = await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "withdrawn" } });
        res.json({ success: true, message: "Proposal withdrawn", data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// CONTRACTS
// ==========================================
export const listFreelancerContracts = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.contract.findMany({
            where: { freelancerId: userId, deletedAt: null },
            include: { project: true, client: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// TASKS
// ==========================================
function freelancerTaskWhere(user) {
    const needles = freelancerNeedles(user);
    return {
        deletedAt: null,
        OR: [
            ...needles.map((n) => ({ assignedTo: { contains: n } })),
            ...needles.map((n) => ({ project: { is: { freelancer: { contains: n } } } })),
        ],
    };
}
export const listFreelancerTasks = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFreelancerUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const rows = await prisma.task.findMany({
            where: freelancerTaskWhere(user),
            include: { project: { select: { id: true, title: true, client: true } }, checklists: true },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateFreelancerTask = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFreelancerUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const task = await prisma.task.findFirst({ where: { id: req.params.id, ...freelancerTaskWhere(user) } });
        if (!task)
            return res.status(404).json({ success: false, message: "Task not found" });
        const body = req.body || {};
        const data = {};
        if (body.status != null)
            data.status = String(body.status).trim();
        if (body.progress != null && body.progress !== "")
            data.progress = Number(body.progress);
        if (body.priority != null)
            data.priority = String(body.priority).trim();
        if (body.dueDate != null)
            data.dueDate = String(body.dueDate).trim() || null;
        const updated = await prisma.task.update({ where: { id: task.id }, data });
        res.json({ success: true, message: "Task updated", data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// MEETINGS
// ==========================================
export const listFreelancerMeetings = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFreelancerUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const rows = await listMeetingsForUser(user);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createFreelancerMeeting = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFreelancerUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const body = req.body || {};
        const title = String(body.title || "Discovery & Strategy Session").trim();
        const participant = String(body.participant || body.client || "Client Participant").trim();
        const mode = String(body.mode || "Google Meet").trim();
        const date = String(body.date || new Date().toISOString().slice(0, 10)).trim();
        const time = String(body.time || "10:00 AM").trim();
        const notes = String(body.notes || "").trim();
        let meeting;
        try {
            const scheduledAt = new Date(`${date} ${time}`);
            meeting = await prisma.meeting.create({
                data: {
                    founder: participant,
                    investor: user.fullName,
                    date,
                    time,
                    mode,
                    status: "Scheduled",
                },
            });
        }
        catch {
            meeting = {
                id: `MTG-${Date.now()}`,
                title,
                status: "Scheduled",
                client: participant,
                mode,
                date,
                time,
                scheduledAt: `${date} ${time}`,
            };
        }
        try {
            const targetUser = await prisma.user.findFirst({
                where: {
                    OR: [{ email: participant }, { fullName: participant }],
                },
                select: { id: true },
            });
            const notifUserIds = Array.from(new Set([userId, targetUser?.id].filter(Boolean)));
            for (const uid of notifUserIds) {
                await prisma.notification.create({
                    data: {
                        userId: uid,
                        type: "meeting",
                        title: `New Meeting Scheduled: ${title}`,
                        message: `Meeting "${title}" with ${user.fullName} & ${participant} scheduled for ${date} at ${time} (${mode}).`,
                        channel: "in_app",
                        priority: "normal",
                        status: "unread",
                    },
                }).catch(() => null);
            }
        }
        catch { }
        try {
            const portalUser = { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
            const conversations = await listConversationsForUser(portalUser);
            const targetConv = conversations[0];
            if (targetConv) {
                await createMessageForUser(portalUser, { conversationId: targetConv.id, content: `📅 Scheduled Meeting: "${title}" on ${date} @ ${time} (${mode}). ${notes ? `Agenda: ${notes}` : ""}` });
            }
        }
        catch { }
        res.status(201).json({ success: true, message: "Meeting scheduled successfully", data: meeting });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createFreelancerNotification = async (req, res, next) => {
    try {
        const body = req.body || {};
        const inputUser = body.userId || body.target || body.targetName;
        const senderId = req.user?.id;
        let targetUserId = inputUser;
        if (inputUser) {
            const dbUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { id: String(inputUser) },
                        { email: String(inputUser) },
                        { fullName: String(inputUser) },
                    ],
                },
                select: { id: true },
            });
            if (dbUser)
                targetUserId = dbUser.id;
        }
        const recipientIds = Array.from(new Set([targetUserId, senderId].filter(Boolean)));
        const createdNotifs = [];
        for (const uid of recipientIds) {
            const notif = await prisma.notification.create({
                data: {
                    userId: uid,
                    type: String(body.type || "project"),
                    title: String(body.title || "New Notification"),
                    message: String(body.message || ""),
                    channel: String(body.channel || "in_app"),
                    priority: String(body.priority || "high"),
                    status: "unread",
                },
            });
            createdNotifs.push(notif);
        }
        res.status(201).json({ success: true, message: "Notification created", data: createdNotifs[0] });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// MESSAGES
// ==========================================
export const listFreelancerMessages = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFreelancerUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const conversationId = req.query.conversationId ? String(req.query.conversationId) : null;
        const portalUser = { id: user.id, fullName: user.fullName, email: user.email, role: user.role };
        if (conversationId) {
            const rows = await listMessagesForConversation(portalUser, conversationId);
            return res.json({ success: true, rows, total: rows.length });
        }
        const rows = await listConversationsForUser(portalUser);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createFreelancerMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFreelancerUser(userId);
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
// REVIEWS
// ==========================================
export const listFreelancerReviews = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.review.findMany({
            where: { revieweeId: userId },
            include: { reviewer: { select: { fullName: true, avatarUrl: true } }, project: { select: { title: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// WALLET
// ==========================================
export const withdrawFreelancerWallet = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const result = await debitWalletForSelf(userId, Number(body.amount), "debit", body.description || "Freelancer withdrawal");
        res.status(201).json({ success: true, message: "Withdrawal successful", data: result });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// INVOICES
// ==========================================
export const listFreelancerInvoices = async (req, res, next) => {
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
// ==========================================
// SUBSCRIPTIONS
// ==========================================
export const listFreelancerSubscriptions = async (req, res, next) => {
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
export const purchaseFreelancerSubscription = async (req, res, next) => {
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
// EXPERIENCE / EDUCATION / CERTIFICATES / SKILLS
// ==========================================
const populateSkillsUsed = async (items) => {
    const isArray = Array.isArray(items);
    const rows = isArray ? items : [items];
    const populated = await Promise.all(rows.map(async (row) => {
        let skillsDetails = [];
        if (row.skillsUsed) {
            const skillIds = row.skillsUsed.split(',').map((s) => s.trim()).filter(Boolean);
            if (skillIds.length > 0) {
                skillsDetails = await prisma.skill.findMany({
                    where: { id: { in: skillIds } },
                    select: { id: true, name: true }
                });
            }
        }
        return { ...row, skillsDetails };
    }));
    return isArray ? populated : populated[0];
};
export const getFreelancerExperience = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.freelancerExperience.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        const populatedRows = await populateSkillsUsed(rows);
        res.json({ success: true, data: populatedRows, total: populatedRows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putFreelancerExperience = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        let items = Array.isArray(req.body) ? req.body : (req.body?.items || null);
        if (!items) {
            if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0)
                items = [req.body];
            else
                return res.status(400).json({ success: false, message: "items array is required" });
        }
        await prisma.$transaction([
            prisma.freelancerExperience.deleteMany({ where: { userId } }),
            prisma.freelancerExperience.createMany({
                data: items.map((item) => ({
                    userId,
                    title: String(item.title || item.designation || ""),
                    company: String(item.company || ""),
                    location: item.location ? String(item.location) : null,
                    industryId: item.industryId ? String(item.industryId) : null,
                    startDate: item.startDate ? String(item.startDate) : null,
                    endDate: item.endDate ? String(item.endDate) : null,
                    isCurrent: Boolean(item.isCurrent),
                    description: item.description ? String(item.description) : null,
                    skillsUsed: Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null),
                })),
            }),
        ]);
        const newRows = await prisma.freelancerExperience.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        const populatedRows = await populateSkillsUsed(newRows);
        res.json({ success: true, message: "Experience updated", data: populatedRows });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const postFreelancerExperience = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const item = req.body;
        const created = await prisma.freelancerExperience.create({
            data: {
                userId,
                title: String(item.title || item.designation || ""),
                company: String(item.company || ""),
                location: item.location ? String(item.location) : null,
                industryId: item.industryId ? String(item.industryId) : null,
                startDate: item.startDate ? String(item.startDate) : null,
                endDate: item.endDate ? String(item.endDate) : null,
                isCurrent: Boolean(item.isCurrent),
                description: item.description ? String(item.description) : null,
                skillsUsed: Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null),
            }
        });
        const populated = await populateSkillsUsed(created);
        res.status(201).json({ success: true, message: "Experience created", data: populated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const deleteFreelancerExperience = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.freelancerExperience.deleteMany({
            where: { id, userId }
        });
        res.json({ success: true, message: "Experience deleted" });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putFreelancerExperienceById = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const item = req.body;
        const existing = await prisma.freelancerExperience.findFirst({
            where: { id, userId }
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Experience not found" });
        }
        const updated = await prisma.freelancerExperience.update({
            where: { id },
            data: {
                title: item.title !== undefined ? String(item.title) : (item.designation !== undefined ? String(item.designation) : undefined),
                company: item.company !== undefined ? String(item.company) : undefined,
                location: item.location !== undefined ? (item.location ? String(item.location) : null) : undefined,
                industryId: item.industryId !== undefined ? (item.industryId ? String(item.industryId) : null) : undefined,
                startDate: item.startDate !== undefined ? (item.startDate ? String(item.startDate) : null) : undefined,
                endDate: item.endDate !== undefined ? (item.endDate ? String(item.endDate) : null) : undefined,
                isCurrent: item.isCurrent !== undefined ? Boolean(item.isCurrent) : undefined,
                description: item.description !== undefined ? (item.description ? String(item.description) : null) : undefined,
                skillsUsed: item.skillsUsed !== undefined ? (Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null)) : undefined,
            }
        });
        const populated = await populateSkillsUsed(updated);
        res.json({ success: true, message: "Experience updated", data: populated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFreelancerEducation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.freelancerEducation.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        // Map the fields for the frontend and response
        const mappedRows = rows.map((r) => ({
            ...r,
            educationFile: r.fileUrl,
            document: r.fileUrl
        }));
        const populatedRows = await populateSkillsUsed(mappedRows);
        res.json({ success: true, data: populatedRows, total: populatedRows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFreelancerEducationByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (!userId)
            return res.status(400).json({ success: false, message: "User ID is required" });
        const rows = await prisma.freelancerEducation.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        const mappedRows = rows.map((r) => ({
            ...r,
            educationFile: r.fileUrl,
            document: r.fileUrl
        }));
        const populatedRows = await populateSkillsUsed(mappedRows);
        res.json({ success: true, data: populatedRows, total: populatedRows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putFreelancerEducation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        let items = Array.isArray(req.body) ? req.body : (req.body?.items || null);
        if (!items) {
            if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
                items = [req.body];
            }
            else {
                return res.status(400).json({ success: false, message: "items array is required" });
            }
        }
        await prisma.$transaction([
            prisma.freelancerEducation.deleteMany({ where: { userId } }),
            prisma.freelancerEducation.createMany({
                data: items.map((item) => ({
                    userId,
                    institution: String(item.institution || ""),
                    qualification: String(item.qualification || ""),
                    specialization: String(item.specialization || ""),
                    year: String(item.year || ""),
                    percentage: String(item.percentage || ""),
                    cert: String(item.cert || ""),
                    category: String(item.category || ""),
                    fileUrl: item.document ? String(item.document) : (item.educationFile ? String(item.educationFile) : (item.fileUrl ? String(item.fileUrl) : null)),
                    fileType: item.fileType ? String(item.fileType) : null,
                    skillsUsed: Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null),
                })),
            }),
        ]);
        const newRows = await prisma.freelancerEducation.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        const populatedRows = await populateSkillsUsed(newRows);
        res.json({ success: true, message: "Education updated", data: populatedRows });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const postFreelancerEducation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const item = req.body;
        const created = await prisma.freelancerEducation.create({
            data: {
                userId,
                institution: String(item.institution || ""),
                qualification: String(item.qualification || ""),
                specialization: String(item.specialization || ""),
                year: String(item.year || ""),
                percentage: String(item.percentage || ""),
                cert: String(item.cert || ""),
                category: String(item.category || ""),
                fileUrl: item.document ? String(item.document) : (item.educationFile ? String(item.educationFile) : (item.fileUrl ? String(item.fileUrl) : null)),
                fileType: item.fileType ? String(item.fileType) : null,
                skillsUsed: Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null),
            }
        });
        const populated = await populateSkillsUsed(created);
        res.status(201).json({ success: true, message: "Education created", data: populated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const deleteFreelancerEducation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.freelancerEducation.deleteMany({
            where: { id, userId }
        });
        res.json({ success: true, message: "Education deleted" });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putFreelancerEducationById = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const item = req.body;
        // Check if the record belongs to the user
        const existing = await prisma.freelancerEducation.findFirst({
            where: { id, userId }
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Education not found" });
        }
        const updated = await prisma.freelancerEducation.update({
            where: { id },
            data: {
                institution: item.institution !== undefined ? String(item.institution) : undefined,
                qualification: item.qualification !== undefined ? String(item.qualification) : undefined,
                specialization: item.specialization !== undefined ? String(item.specialization) : undefined,
                year: item.year !== undefined ? String(item.year) : undefined,
                percentage: item.percentage !== undefined ? String(item.percentage) : undefined,
                cert: item.cert !== undefined ? String(item.cert) : undefined,
                category: item.category !== undefined ? String(item.category) : undefined,
                fileUrl: item.document !== undefined ? String(item.document) : (item.educationFile !== undefined ? String(item.educationFile) : (item.fileUrl !== undefined ? (item.fileUrl ? String(item.fileUrl) : null) : undefined)),
                fileType: item.fileType !== undefined ? (item.fileType ? String(item.fileType) : null) : undefined,
                skillsUsed: item.skillsUsed !== undefined ? (Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null)) : undefined,
            }
        });
        const populated = await populateSkillsUsed(updated);
        res.json({ success: true, message: "Education updated", data: populated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFreelancerCertificates = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await prisma.freelancerCertificate.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        // Map the fields for the frontend and response
        const mappedRows = rows.map((r) => ({
            ...r,
            certificateUrl: r.url,
            certificateFile: r.fileUrl
        }));
        const populatedRows = await populateSkillsUsed(mappedRows);
        res.json({ success: true, data: populatedRows, total: populatedRows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putFreelancerCertificates = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        let items = Array.isArray(req.body) ? req.body : (req.body?.items || null);
        if (!items) {
            if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
                items = [req.body];
            }
            else {
                return res.status(400).json({ success: false, message: "items array is required" });
            }
        }
        await prisma.$transaction([
            prisma.freelancerCertificate.deleteMany({ where: { userId } }),
            prisma.freelancerCertificate.createMany({
                data: items.map((item) => ({
                    userId,
                    name: String(item.name || ""),
                    issuer: String(item.issuer || ""),
                    number: String(item.number || ""),
                    issued: String(item.issued || ""),
                    url: item.certificateUrl ? String(item.certificateUrl) : (item.url ? String(item.url) : null),
                    verified: Boolean(item.verified),
                    fileUrl: item.certificateFile ? String(item.certificateFile) : (item.fileUrl ? String(item.fileUrl) : null),
                    fileType: item.fileType ? String(item.fileType) : null,
                    skillsUsed: Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null),
                })),
            }),
        ]);
        const newRows = await prisma.freelancerCertificate.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        const populatedRows = await populateSkillsUsed(newRows);
        res.json({ success: true, message: "Certificates updated", data: populatedRows });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const postFreelancerCertificates = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const item = req.body;
        const created = await prisma.freelancerCertificate.create({
            data: {
                userId,
                name: String(item.name || ""),
                issuer: String(item.issuer || ""),
                number: String(item.number || ""),
                issued: String(item.issued || ""),
                url: item.certificateUrl ? String(item.certificateUrl) : (item.url ? String(item.url) : null),
                verified: Boolean(item.verified),
                fileUrl: item.certificateFile ? String(item.certificateFile) : (item.fileUrl ? String(item.fileUrl) : null),
                fileType: item.fileType ? String(item.fileType) : null,
                skillsUsed: Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null),
            }
        });
        const populated = await populateSkillsUsed(created);
        res.status(201).json({ success: true, message: "Certificate created", data: populated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const deleteFreelancerCertificates = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.freelancerCertificate.deleteMany({
            where: { id, userId }
        });
        res.json({ success: true, message: "Certificate deleted" });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putFreelancerCertificateById = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const item = req.body;
        // Check if the record belongs to the user
        const existing = await prisma.freelancerCertificate.findFirst({
            where: { id, userId }
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Certificate not found" });
        }
        const updated = await prisma.freelancerCertificate.update({
            where: { id },
            data: {
                name: item.name !== undefined ? String(item.name) : undefined,
                issuer: item.issuer !== undefined ? String(item.issuer) : undefined,
                number: item.number !== undefined ? String(item.number) : undefined,
                issued: item.issued !== undefined ? String(item.issued) : undefined,
                url: item.certificateUrl !== undefined ? String(item.certificateUrl) : (item.url !== undefined ? (item.url ? String(item.url) : null) : undefined),
                verified: item.verified !== undefined ? Boolean(item.verified) : undefined,
                fileUrl: item.certificateFile !== undefined ? String(item.certificateFile) : (item.fileUrl !== undefined ? (item.fileUrl ? String(item.fileUrl) : null) : undefined),
                fileType: item.fileType !== undefined ? (item.fileType ? String(item.fileType) : null) : undefined,
                skillsUsed: item.skillsUsed !== undefined ? (Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null)) : undefined,
            }
        });
        const populated = await populateSkillsUsed(updated);
        res.json({ success: true, message: "Certificate updated", data: populated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFreelancerSkills = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await getJsonSetting(userId, "skills-detail", []);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putFreelancerSkills = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const items = Array.isArray(req.body) ? req.body : req.body?.items;
        if (!Array.isArray(items))
            return res.status(400).json({ success: false, message: "items array is required" });
        await setJsonSetting(userId, "skills-detail", items);
        const names = items
            .map((i) => (typeof i === "string" ? i : i?.name))
            .filter(Boolean)
            .join(", ");
        await prisma.freelancerProfile.upsert({
            where: { userId },
            update: { skills: names },
            create: { userId, skills: names },
        });
        res.json({ success: true, message: "Skills updated", rows: items });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// SAVED PROJECTS
// ==========================================
export const listSavedProjects = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const saved = await getJsonSetting(userId, "saved-projects", []);
        const rows = saved.length
            ? await prisma.project.findMany({ where: { id: { in: saved }, deletedAt: null } })
            : [];
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const saveProject = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const projectId = String(req.body?.projectId || "").trim();
        if (!projectId)
            return res.status(400).json({ success: false, message: "projectId is required" });
        const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });
        const saved = await getJsonSetting(userId, "saved-projects", []);
        if (!saved.includes(projectId))
            saved.push(projectId);
        await setJsonSetting(userId, "saved-projects", saved);
        res.status(201).json({ success: true, message: "Project saved", data: project });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const unsaveProject = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const saved = await getJsonSetting(userId, "saved-projects", []);
        const next = saved.filter((id) => id !== req.params.id);
        await setJsonSetting(userId, "saved-projects", next);
        res.json({ success: true, message: "Project removed from saved list", rows: next });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// SETTINGS
// ==========================================
export const getFreelancerSettings = async (req, res, next) => {
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
export const updateFreelancerSettings = async (req, res, next) => {
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
// ANALYTICS
// ==========================================
export const getFreelancerAnalytics = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// PROFILE COVER
// ==========================================
export const updateFreelancerCover = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const coverUrl = body.coverUrl != null ? String(body.coverUrl).trim() : "";
        const avatarUrl = body.avatarUrl != null ? String(body.avatarUrl).trim() : null;
        const existing = await getJsonSetting(userId, "settings", {});
        const merged = { ...existing, coverUrl };
        await setJsonSetting(userId, "settings", merged);
        if (avatarUrl) {
            await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
        }
        res.json({ success: true, message: "Cover updated", data: { coverUrl, avatarUrl } });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// CLIENTS / RESUME / REFERRALS / EARNINGS / ACTIVITY
// ==========================================
export const listFreelancerClients = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const contracts = await prisma.contract.findMany({
            where: { freelancerId: userId, deletedAt: null },
            include: {
                client: { select: { id: true, fullName: true, email: true, avatarUrl: true, city: true, country: true } },
                project: { select: { id: true, title: true, status: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        const byClient = new Map();
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
                    projects: [],
                });
            }
            const row = byClient.get(key);
            row.contracts += 1;
            if (c.project)
                row.projects.push(c.project);
        }
        const rows = Array.from(byClient.values());
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFreelancerResume = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const config = await getJsonSetting(userId, "resume", {
            template: "modern",
            sections: {},
            headline: "",
            summary: "",
        });
        const pdfUrl = `${req.protocol}://${req.get("host")}/api/v1/mobile/freelancer/resume/export`;
        // Fetch all user profile details
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: {
                freelancerProfile: true
            }
        });
        const rawExperiences = await prisma.freelancerExperience.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
        const experiences = await populateSkillsUsed(rawExperiences);
        const rawEducation = await prisma.freelancerEducation.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
        const education = await populateSkillsUsed(rawEducation);
        const rawCertificates = await prisma.freelancerCertificate.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
        const certificates = await populateSkillsUsed(rawCertificates);
        res.json({
            success: true,
            data: {
                config,
                fileUrl: pdfUrl,
                downloadUrl: pdfUrl,
                profile: {
                    fullName: user?.fullName,
                    email: user?.email,
                    phone: user?.phone,
                    avatarUrl: user?.avatarUrl,
                    title: user?.freelancerProfile?.titleHeadline,
                    bio: user?.freelancerProfile?.overview,
                    hourlyRate: user?.freelancerProfile?.hourlyRate,
                    location: user?.location,
                    website: user?.freelancerProfile?.portfolioUrl,
                    linkedin: user?.freelancerProfile?.linkedInUrl,
                    github: user?.freelancerProfile?.githubUrl,
                    skills: user?.freelancerProfile?.skills
                },
                experiences: Array.isArray(experiences) ? experiences : (experiences ? [experiences] : []),
                education: Array.isArray(education) ? education : (education ? [education] : []),
                certificates: Array.isArray(certificates) ? certificates : (certificates ? [certificates] : [])
            }
        });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
import { ResumeExportService } from "../../services/resume/resume-export.service.js";
export const exportFreelancerResumePdf = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const pdfBuffer = await ResumeExportService.generatePdf(userId);
        const ctx = await ResumeExportService.loadExportContext(userId); // Getting context again just for filename... wait, we can just fetch user
        const profile = ctx.profile;
        const filename = `${(profile.firstName || 'go').toLowerCase()}-${(profile.lastName || 'experts').toLowerCase()}-resume.pdf`;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
    }
    catch (err) {
        if (err.message === "SERVER_BUSY") {
            res.status(429).json({ success: false, message: "Server is currently busy generating other resumes. Please try again in a few moments." });
            return;
        }
        handleError(err, res, next);
    }
};
export const putFreelancerResume = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const safeName = (user?.fullName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const mockPdfUrl = `https://apiai.goexperts.in/uploads/mock_resume_${safeName}.pdf`;
        const existing = await getJsonSetting(userId, "resume", {});
        const merged = { ...existing, ...(req.body || {}) };
        await setJsonSetting(userId, "resume", merged);
        let currentReg = {};
        if (user?.registrationData) {
            if (typeof user.registrationData === 'string') {
                try {
                    currentReg = JSON.parse(user.registrationData);
                }
                catch { }
            }
            else if (typeof user.registrationData === 'object') {
                currentReg = user.registrationData;
            }
        }
        await prisma.user.update({
            where: { id: userId },
            data: {
                registrationData: JSON.stringify({
                    ...currentReg,
                    resume: mockPdfUrl,
                    resumeUrl: mockPdfUrl
                })
            }
        });
        res.json({ success: true, message: "Resume generated successfully", data: { ...merged, resumeUrl: mockPdfUrl } });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFreelancerReferrals = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
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
            history: [],
        });
        res.json({
            success: true,
            data: {
                code: stored.code,
                history: referrals.length
                    ? referrals.map((r) => ({
                        id: r.id,
                        name: r.referee?.fullName || r.refereeId,
                        email: r.referee?.email || "",
                        status: r.status,
                        date: r.createdAt,
                        reward: r.rewards?.[0]?.amount ?? 0,
                    }))
                    : stored.history || [],
                leaderboard: stored.leaderboard || [],
            },
        });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFreelancerEarnings = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const wallet = await getUserWalletPayload(userId);
        const payments = await prisma.payment.findMany({
            where: { userId, status: { in: ["completed", "success", "paid"] } },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        const byMonth = {};
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listFreelancerActivity = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
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
            getJsonSetting(userId, "activity", []),
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
                title: `Meeting · ${m.mode || "Session"}`,
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createFreelancerActivity = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const title = String(body.title || "Activity").trim();
        const type = String(body.type || "profile").trim().toLowerCase();
        const detail = String(body.detail || "").trim();
        const existing = await getJsonSetting(userId, "activity", []);
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
        }
        catch {
            // ignore
        }
        res.status(201).json({ success: true, message: "Activity logged", data: newEntry, rows: nextList });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
