import { prisma } from "../../config/database.js";
import { requireCapability, ActionRequirementsError } from "../../services/mobile/profile-readiness.service.js";
import { HttpError, getUserWalletPayload, creditWalletForSelf, debitWalletForSelf, listInvoicesForUser, listMeetingsForUser, createMeetingForUser, listUserNotifications, markNotificationRead, markAllNotificationsRead, getJsonSetting, setJsonSetting, listConversationsForUser, listMessagesForConversation, createMessageForUser, purchaseSubscriptionForSelf, listSubscriptionsForUser, } from "../../common/helpers/portal-shared.js";
async function loadFounderUser(userId) {
    return prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: { founderProfile: true },
    });
}
function founderNeedles(user, profile) {
    return [user.fullName, user.email, profile?.startupName].map((v) => String(v || "").trim()).filter(Boolean);
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
async function findExistingStartup(user) {
    const needles = founderNeedles(user, user.founderProfile);
    if (needles.length) {
        const existing = await prisma.startupIdea.findFirst({
            where: { deletedAt: null, OR: needles.map((n) => ({ founder: { contains: n } })) },
            orderBy: { createdAt: "desc" },
        });
        if (existing)
            return existing;
    }
    return null;
}
// ==========================================
// DASHBOARD
// ==========================================
export const getFounderDashboard = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        const [investorRequests, pendingRequests, acceptedRequests, wallet, unreadNotifications] = await Promise.all([
            startup ? prisma.investment.count({ where: { deletedAt: null, startup: { contains: startup.startup } } }) : 0,
            startup ? prisma.investment.count({ where: { deletedAt: null, startup: { contains: startup.startup }, status: "Pending" } }) : 0,
            startup ? prisma.investment.count({
                where: { deletedAt: null, startup: { contains: startup.startup }, status: { in: ["Accepted", "Completed"] } },
            }) : 0,
            getUserWalletPayload(userId),
            prisma.notification.count({
                where: {
                    status: { notIn: ["cancelled", "draft"] },
                    readAt: null,
                    NOT: { status: "read" },
                    OR: [{ userId }, { AND: [{ userId: null }, { role: "founder" }] }],
                },
            }),
        ]);
        const raised = Number(user.founderProfile?.raised ?? 0);
        res.json({
            success: true,
            data: {
                profile: {
                    id: user.id,
                    name: user.fullName,
                    firstName: (user.fullName || "there").split(" ")[0],
                    email: user.email,
                    avatar: user.avatarUrl || null,
                },
                startup,
                counts: {
                    notifications: unreadNotifications,
                    investors: investorRequests,
                    meetings: 0,
                    messages: 0,
                },
                kpis: [
                    { key: "startupProfile", label: "Startup Profile Status", value: startup?.id ? "Active" : "Incomplete" },
                    { key: "pitchViews", label: "Investor Views", value: String(startup?.views ?? 0) },
                    { key: "investorInterests", label: "Investor Interests", value: String(investorRequests) },
                    { key: "contactRequests", label: "Contact Requests", value: "0" },
                    { key: "deckDownloads", label: "Pitch Deck Downloads", value: "0" },
                    { key: "unreadMessages", label: "Unread Messages", value: "0" }, // Will be updated by frontend fetch
                    { key: "pendingMeetings", label: "Scheduled Meetings", value: "0" }, // Will be updated by frontend fetch
                    { key: "subscriptionStatus", label: "Subscription Status", value: "Free Founder Plan" },
                    { key: "profileCompletion", label: "Profile Strength Score", value: "0%" }, // Updated by frontend
                ],
                wallet,
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
export const getFounderProfile = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const details = await getJsonSetting(userId, "founder-profile-details", {});
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
                startupName: user.founderProfile?.startupName || "",
                industry: user.founderProfile?.industry || "",
                stage: user.founderProfile?.stage || "",
                raised: Number(user.founderProfile?.raised ?? 0),
                teamSize: user.founderProfile?.teamSize ?? 1,
                status: user.status,
                verified: Boolean(user.isVerified || user.verified),
                role: user.role,
                ...details,
            },
        });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateFounderProfile = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const existing = await loadFounderUser(userId);
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
        await prisma.founderProfile.upsert({
            where: { userId },
            update: {
                startupName: body.startupName != null ? String(body.startupName).trim() || null : existing.founderProfile?.startupName ?? null,
                industry: body.industry != null ? String(body.industry).trim() || null : existing.founderProfile?.industry ?? null,
                stage: body.stage != null ? String(body.stage).trim() || null : existing.founderProfile?.stage ?? null,
                teamSize: body.teamSize != null && body.teamSize !== "" ? Number(body.teamSize) : existing.founderProfile?.teamSize ?? 1,
            },
            create: {
                userId,
                startupName: body.startupName != null ? String(body.startupName).trim() || null : null,
                industry: body.industry != null ? String(body.industry).trim() || null : null,
                stage: body.stage != null ? String(body.stage).trim() || null : null,
                teamSize: body.teamSize != null && body.teamSize !== "" ? Number(body.teamSize) : 1,
            },
        });
        const extraFields = ["website", "linkedin", "location", "education", "experience"];
        const details = await getJsonSetting(userId, "founder-profile-details", {});
        for (const key of extraFields) {
            if (body[key] !== undefined) {
                details[key] = body[key];
            }
        }
        await setJsonSetting(userId, "founder-profile-details", details);
        return getFounderProfile(req, res, next);
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// STARTUP
// ==========================================
export const getFounderStartup = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        if (!startup) {
            return res.json({ success: true, message: "No startup idea found", data: null });
        }
        const details = await getJsonSetting(userId, "startup-details", {});
        res.json({ success: true, data: { ...startup, ...details } });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateFounderStartup = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        const body = req.body || {};
        const data = {};
        if (body.startup != null)
            data.startup = String(body.startup).trim();
        if (body.industry != null)
            data.industry = String(body.industry).trim();
        if (body.category != null)
            data.category = String(body.category).trim();
        if (body.stage != null)
            data.stage = String(body.stage).trim();
        if (body.amountRaising != null && body.amountRaising !== "")
            data.funding = Number(body.amountRaising);
        else if (body.funding != null && body.funding !== "")
            data.funding = Number(body.funding);
        if (body.equityOffered != null && body.equityOffered !== "")
            data.equity = Number(body.equityOffered);
        else if (body.equity != null && body.equity !== "")
            data.equity = Number(body.equity);
        if (body.visibility != null)
            data.visibility = String(body.visibility).trim();
        if (body.status != null)
            data.status = String(body.status).trim();
        let updated;
        if (startup) {
            updated = await prisma.startupIdea.update({ where: { id: startup.id }, data });
        }
        else {
            const startupName = data.startup || user.founderProfile?.startupName;
            if (!startupName) {
                return res.status(400).json({ success: false, message: "Startup name is required" });
            }
            updated = await prisma.startupIdea.create({
                data: {
                    startup: startupName,
                    founder: user.id,
                    industry: data.industry || user.founderProfile?.industry || "General",
                    category: data.category || user.founderProfile?.industry || "General",
                    stage: data.stage || user.founderProfile?.stage || "Idea",
                    funding: data.funding || 0,
                    equity: data.equity || 0,
                    visibility: data.visibility || "Public",
                    status: data.status || "active",
                }
            });
        }
        if (data.startup) {
            await prisma.founderProfile.upsert({
                where: { userId },
                update: { startupName: data.startup },
                create: { userId, startupName: data.startup },
            });
        }
        // Save extra fields to JSON setting
        const extraFields = [
            "legalName", "foundedYear", "country", "website", "linkedin",
            "oneLinePitch", "problem", "solution", "businessModel",
            "revenueModel", "targetMarket", "competitiveAdvantage",
            "technologyStack", "amountRaising", "equityOffered",
            "valuation", "runway", "burnRate"
        ];
        const details = await getJsonSetting(userId, "startup-details", {});
        for (const key of extraFields) {
            if (body[key] !== undefined) {
                details[key] = body[key];
            }
        }
        await setJsonSetting(userId, "startup-details", details);
        res.json({ success: true, message: "Startup updated", data: { ...updated, ...details } });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// BUSINESS PLAN / PITCH DECK (settings-backed JSON blobs)
// ==========================================
export const getBusinessPlan = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const data = await getJsonSetting(userId, "business-plan", {
            summary: "",
            problem: "",
            solution: "",
            market: "",
            competition: "",
            businessModel: "",
            financials: "",
            updatedAt: null,
        });
        res.json({ success: true, data });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putBusinessPlan = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const existing = await getJsonSetting(userId, "business-plan", {});
        const merged = { ...existing, ...(req.body || {}), updatedAt: new Date().toISOString() };
        await setJsonSetting(userId, "business-plan", merged);
        res.json({ success: true, message: "Business plan saved", data: merged });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getPitchDeck = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const data = await getJsonSetting(userId, "pitch-deck", { url: "", slides: [], updatedAt: null });
        res.json({ success: true, data });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const putPitchDeck = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const existing = await getJsonSetting(userId, "pitch-deck", {});
        const merged = { ...existing, ...(req.body || {}), updatedAt: new Date().toISOString() };
        await setJsonSetting(userId, "pitch-deck", merged);
        res.json({ success: true, message: "Pitch deck saved", data: merged });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// FUNDING
// ==========================================
export const getFounderFunding = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        if (!startup) {
            return res.json({
                success: true,
                data: {
                    target: 0,
                    totalRaised: 0,
                    equityGiven: 0,
                    dealsAccepted: 0,
                    dealsPending: 0,
                    investments: [],
                },
            });
        }
        const investments = await prisma.investment.findMany({
            where: { deletedAt: null, startup: { contains: startup.startup } },
            orderBy: { createdAt: "desc" },
        });
        const accepted = investments.filter((i) => ["Accepted", "Completed"].includes(i.status));
        const totalRaised = accepted.reduce((s, i) => s + Number(i.offer || 0), 0);
        const equityGiven = accepted.reduce((s, i) => s + Number(i.equity || 0), 0);
        res.json({
            success: true,
            data: {
                target: Number(startup.funding || 0),
                totalRaised,
                equityGiven,
                dealsAccepted: accepted.length,
                dealsPending: investments.filter((i) => i.status === "Pending").length,
                investments,
            },
        });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// INVESTOR REQUESTS / INVESTORS
// ==========================================
export const listInvestorRequests = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        if (!startup) {
            return res.json({ success: true, rows: [], total: 0 });
        }
        const rows = await prisma.investment.findMany({
            where: { deletedAt: null, startup: { contains: startup.startup } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const respondInvestorRequest = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        if (!startup)
            return res.status(404).json({ success: false, message: "Startup not found" });
        const investment = await prisma.investment.findFirst({
            where: { id: req.params.id, deletedAt: null, startup: { contains: startup.startup } },
        });
        if (!investment)
            return res.status(404).json({ success: false, message: "Investor request not found" });
        const action = String(req.body?.action || "").toLowerCase();
        const status = action === "accept" ? "Accepted" : action === "reject" ? "Rejected" : null;
        if (!status)
            return res.status(400).json({ success: false, message: "action must be 'accept' or 'reject'" });
        const updated = await prisma.investment.update({ where: { id: investment.id }, data: { status } });
        if (status === "Accepted") {
            await prisma.founderProfile.upsert({
                where: { userId },
                update: { raised: { increment: Number(investment.offer || 0) } },
                create: { userId, raised: Number(investment.offer || 0) },
            });
        }
        res.json({ success: true, message: `Investor request ${status.toLowerCase()}`, data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listFounderInvestors = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        if (!startup) {
            return res.json({ success: true, rows: [] });
        }
        const investments = await prisma.investment.findMany({
            where: { deletedAt: null, startup: { contains: startup.startup } },
        });
        const names = [...new Set(investments.map((i) => i.investor).filter(Boolean))];
        const users = names.length
            ? await prisma.user.findMany({
                where: { role: "investor", deletedAt: null, OR: names.map((n) => ({ fullName: n })) },
                include: { investorProfile: true },
            })
            : [];
        const rows = names.map((name) => {
            const match = users.find((u) => u.fullName === name);
            const deals = investments.filter((i) => i.investor === name);
            return {
                name,
                userId: match?.id || null,
                email: match?.email || null,
                firm: match?.investorProfile?.firm || null,
                deals: deals.length,
                totalOffered: deals.reduce((s, d) => s + Number(d.offer || 0), 0),
            };
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listAllInvestors = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        // Fetch all users exactly as the Admin Panel does
        const users = await prisma.user.findMany({
            where: { role: { in: ["investor", "Investor"] }, deletedAt: null },
            include: { investorProfile: true },
        });
        const rows = users.map((u) => ({
            name: u.fullName,
            userId: u.id,
            email: u.email,
            firm: u.investorProfile?.firm || null,
        }));
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// TEAM / DOCUMENTS / MILESTONES (settings-backed JSON)
// ==========================================
export const listFounderTeam = async (req, res, next) => {
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
export const addFounderTeamMember = async (req, res, next) => {
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
        await prisma.founderProfile.upsert({
            where: { userId },
            update: { teamSize: next.length + 1 },
            create: { userId, teamSize: next.length + 1 },
        });
        res.status(201).json({ success: true, message: "Team member added", data: member, rows: next });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const deleteFounderTeamMember = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        if (!id)
            return res.status(400).json({ success: false, message: "id is required" });
        const rows = await getJsonSetting(userId, "team", []);
        const nextRows = rows.filter((r) => r.id !== id);
        await setJsonSetting(userId, "team", nextRows);
        await prisma.founderProfile.upsert({
            where: { userId },
            update: { teamSize: nextRows.length + 1 },
            create: { userId, teamSize: nextRows.length + 1 },
        });
        res.json({ success: true, message: "Team member removed", rows: nextRows });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listFounderDocuments = async (req, res, next) => {
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
export const addFounderDocument = async (req, res, next) => {
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
export const listFounderMilestones = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await getJsonSetting(userId, "milestones", []);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const addFounderMilestone = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const title = String(body.title || "").trim();
        if (!title)
            return res.status(400).json({ success: false, message: "title is required" });
        const rows = await getJsonSetting(userId, "milestones", []);
        const milestone = {
            id: `MS-${Date.now().toString(36).toUpperCase()}`,
            title,
            status: body.status || "Pending",
            dueDate: body.dueDate || null,
            createdAt: new Date().toISOString(),
        };
        const next = [milestone, ...rows];
        await setJsonSetting(userId, "milestones", next);
        res.status(201).json({ success: true, message: "Milestone added", data: milestone, rows: next });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateFounderMilestone = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await getJsonSetting(userId, "milestones", []);
        const idx = rows.findIndex((m) => m.id === req.params.id);
        if (idx < 0)
            return res.status(404).json({ success: false, message: "Milestone not found" });
        const body = req.body || {};
        rows[idx] = { ...rows[idx], ...body, id: rows[idx].id };
        await setJsonSetting(userId, "milestones", rows);
        res.json({ success: true, message: "Milestone updated", data: rows[idx], rows });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const deleteFounderMilestone = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const rows = await getJsonSetting(userId, "milestones", []);
        const idx = rows.findIndex((m) => m.id === req.params.id);
        if (idx < 0)
            return res.status(404).json({ success: false, message: "Milestone not found" });
        rows.splice(idx, 1);
        await setJsonSetting(userId, "milestones", rows);
        res.json({ success: true, message: "Milestone deleted", rows });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// MEETINGS
// ==========================================
export const listFounderMeetings = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const rows = await listMeetingsForUser(user, [user.founderProfile?.startupName]);
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const createFounderMeeting = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
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
export const listFounderMessages = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
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
export const createFounderMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        // A founder messaging someone is generally a 'contactInvestor' intent if we don't have a more specific role target
        // We enforce the capability here
        try {
            await requireCapability({ userId, action: "contactInvestor" });
        }
        catch (err) {
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
        const user = await loadFounderUser(userId);
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
export const getFounderWallet = async (req, res, next) => {
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
export const depositFounderWallet = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const result = await creditWalletForSelf(userId, Number(body.amount), "promotional", body.description || "Wallet deposit");
        res.status(201).json({ success: true, message: "Wallet deposit successful", data: result });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const withdrawFounderWallet = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const body = req.body || {};
        const result = await debitWalletForSelf(userId, Number(body.amount), "withdrawal", body.description || "Wallet withdrawal", "pending");
        res.status(201).json({ success: true, message: "Withdrawal request submitted", data: result });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// INVOICES
// ==========================================
export const listFounderInvoices = async (req, res, next) => {
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
// ANALYTICS / REPORTS
// ==========================================
export const getFounderAnalytics = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        if (!startup) {
            return res.json({
                success: true,
                data: {
                    views: 0,
                    interestedInvestors: 0,
                    investmentsByStatus: [],
                    totalRequests: 0,
                },
            });
        }
        const investments = await prisma.investment.findMany({
            where: { deletedAt: null, startup: { contains: startup.startup } },
        });
        const byStatus = new Map();
        for (const i of investments) {
            byStatus.set(i.status, (byStatus.get(i.status) || 0) + 1);
        }
        res.json({
            success: true,
            data: {
                views: startup.views,
                interestedInvestors: startup.interestedInvestors,
                investmentsByStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
                totalRequests: investments.length,
            },
        });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const getFounderReports = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const user = await loadFounderUser(userId);
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        const startup = await findExistingStartup(user);
        const investments = startup ? await prisma.investment.findMany({
            where: { deletedAt: null, startup: { contains: startup.startup } },
            orderBy: { createdAt: "desc" },
        }) : [];
        const now = new Date();
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                month: d.toLocaleString("en-US", { month: "short" }),
                raised: 0,
                deals: 0,
            });
        }
        for (const inv of investments) {
            if (!["Accepted", "Completed"].includes(inv.status))
                continue;
            const d = new Date(inv.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const bucket = months.find((m) => m.key === key);
            if (bucket) {
                bucket.raised += Number(inv.offer || 0);
                bucket.deals += 1;
            }
        }
        res.json({ success: true, data: { series: months, totalDeals: investments.length } });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// NOTIFICATIONS
// ==========================================
export const listFounderNotifications = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const data = await listUserNotifications(userId, "founder", req.query);
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
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const markFounderNotificationRead = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const updated = await markNotificationRead(userId, "founder", req.params.id);
        if (!updated)
            return res.status(404).json({ success: false, message: "Notification not found" });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const markAllFounderNotificationsRead = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const count = await markAllNotificationsRead(userId, "founder");
        res.json({ success: true, message: "All notifications marked as read", data: { updated: count } });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
// ==========================================
// SUBSCRIPTION
// ==========================================
export const listFounderSubscriptions = async (req, res, next) => {
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
export const purchaseFounderSubscription = async (req, res, next) => {
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
// SETTINGS
// ==========================================
export const getFounderSettings = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const data = await getJsonSetting(userId, "settings", {
            emailNotifications: true,
            pushNotifications: true,
            investorAlerts: true,
            language: "en",
            timezone: "UTC",
        });
        res.json({ success: true, data });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const updateFounderSettings = async (req, res, next) => {
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
export const listFounderRoles = async (req, res, next) => {
    try {
        const roles = await prisma.masterOption.findMany({
            where: { status: "active", type: "founder_role" },
            orderBy: { sortOrder: "asc" }
        });
        const formattedRoles = roles.map(r => ({ id: r.id, name: r.label }));
        res.json({ success: true, rows: formattedRoles, total: roles.length });
    }
    catch (err) {
        handleError(err, res, next);
    }
};
export const listFounderReviews = async (req, res, next) => {
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
        next(err);
    }
};
