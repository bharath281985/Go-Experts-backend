import { prisma } from "../../config/database.js";
function money(n, currency = "USD") {
    const value = Number.isFinite(n) ? n : 0;
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency === "INR" ? "INR" : "USD",
            maximumFractionDigits: 0,
        }).format(value);
    }
    catch {
        return `$${Math.round(value).toLocaleString("en-US")}`;
    }
}
function pct(part, total) {
    if (!total)
        return 0;
    return Math.round((part / total) * 100);
}
function filled(...values) {
    return values.filter((v) => {
        if (v == null)
            return false;
        if (typeof v === "string")
            return v.trim().length > 0;
        if (typeof v === "number")
            return Number.isFinite(v);
        if (typeof v === "boolean")
            return true;
        return Boolean(v);
    }).length;
}
const PORTFOLIO_STATUSES = ["Published", "Featured", "Case Study", "Draft", "Archived"];
function parsePortfolioJson(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .filter((x) => x && typeof x === "object")
            .map((x) => normalizePortfolioItem(x))
            .filter((x) => Boolean(x.id && x.title));
    }
    catch {
        return [];
    }
}
function normalizePortfolioItem(input, fallbackId) {
    const statusRaw = String(input?.status || "Draft").trim();
    const status = PORTFOLIO_STATUSES.includes(statusRaw) ? statusRaw : "Draft";
    const gallery = Array.isArray(input?.gallery)
        ? input.gallery.map(String).filter(Boolean)
        : typeof input?.gallery === "string" && input.gallery.trim()
            ? input.gallery.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
    const skills = Array.isArray(input?.skills) ? input.skills : [];
    let tech = String(input?.tech || "").trim();
    if (!tech && skills.length > 0) {
        tech = skills.map((s) => s.skillName || s.name || s).join(", ");
    }
    return {
        id: String(input?.id || fallbackId || `PF-${Date.now().toString(36).toUpperCase()}`),
        title: String(input?.title || "").trim(),
        thumb: String(input?.thumb || input?.imageUrl || input?.coverMedia || "").trim(),
        category: String(input?.category || "").trim(),
        categoryId: input?.categoryId ? String(input.categoryId) : "",
        tech,
        skills: skills.length > 0 ? skills : [],
        industry: String(input?.industry || "").trim(),
        industryId: input?.industryId ? String(input.industryId) : "",
        client: String(input?.client || "").trim(),
        duration: String(input?.duration || "").trim(),
        team: Math.max(0, Number(input?.team) || 1),
        teamSize: input?.teamSize ? String(input.teamSize) : "",
        teamSizeId: input?.teamSizeId ? String(input.teamSizeId) : "",
        role: String(input?.role || "").trim(),
        status,
        views: Math.max(0, Number(input?.views) || 0),
        likes: Math.max(0, Number(input?.likes) || 0),
        shares: Math.max(0, Number(input?.shares) || 0),
        created: String(input?.created || new Date().toISOString().slice(0, 10)),
        overview: input?.overview != null ? String(input.overview) : "",
        githubUrl: input?.githubUrl != null ? String(input.githubUrl) : "",
        liveUrl: input?.liveUrl != null ? String(input.liveUrl) : "",
        pdfUrl: input?.pdfUrl != null ? String(input.pdfUrl) : (input?.pdfCaseStudy ? String(input.pdfCaseStudy) : ""),
        pdfCaseStudy: input?.pdfCaseStudy != null ? String(input.pdfCaseStudy) : "",
        videoUrl: input?.videoUrl != null ? String(input.videoUrl) : (input?.videoDemo ? String(input.videoDemo) : ""),
        videoDemo: input?.videoDemo != null ? String(input.videoDemo) : "",
        coverMedia: input?.coverMedia != null ? String(input.coverMedia) : "",
        extraScreenshot: input?.extraScreenshot != null ? String(input.extraScreenshot) : "",
        gallery,
    };
}
function portfolioKpis(items) {
    const totalViews = items.reduce((s, i) => s + (i.views || 0), 0);
    const totalLikes = items.reduce((s, i) => s + (i.likes || 0), 0);
    const totalShares = items.reduce((s, i) => s + (i.shares || 0), 0);
    const featured = items.filter((i) => i.status === "Featured").length;
    const drafts = items.filter((i) => i.status === "Draft").length;
    const published = items.filter((i) => ["Published", "Featured", "Case Study"].includes(i.status)).length;
    const withPdf = items.filter((i) => i.pdfUrl).length;
    return [
        { label: "Portfolio Items", value: String(items.length), delta: `${published} live` },
        { label: "Featured", value: String(featured), delta: featured ? "pinned" : "none yet" },
        { label: "Views", value: totalViews.toLocaleString("en-US"), delta: "all time" },
        { label: "Likes", value: totalLikes.toLocaleString("en-US"), delta: "engagement" },
        { label: "Shares", value: totalShares.toLocaleString("en-US"), delta: "referrals" },
        { label: "Downloads", value: String(withPdf), delta: "PDF case studies" },
        { label: "Drafts", value: String(drafts), delta: "in progress" },
        { label: "Published", value: String(published), delta: "public items" },
    ];
}
async function loadPortfolioItems(userId) {
    const profile = await prisma.freelancerProfile.findUnique({ where: { userId } });
    const setting = await prisma.setting.findUnique({ where: { key: `freelancer_portfolio:${userId}` } });
    let items = parsePortfolioJson(profile?.portfolioJson);
    if (items.length === 0 && setting?.value) {
        items = parsePortfolioJson(setting.value);
    }
    if (items.length === 0) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        let regData = {};
        if (user?.registrationData) {
            regData = typeof user.registrationData === "string" ? JSON.parse(user.registrationData) : user.registrationData;
        }
        if (Array.isArray(regData.portfolioItems) && regData.portfolioItems.length > 0) {
            items = parsePortfolioJson(JSON.stringify(regData.portfolioItems));
        }
    }
    return {
        items,
        profileId: profile?.id || null,
    };
}
async function savePortfolioItems(userId, items) {
    const jsonStr = JSON.stringify(items);
    await prisma.freelancerProfile.upsert({
        where: { userId },
        update: { portfolioJson: jsonStr },
        create: { userId, portfolioJson: jsonStr },
    });
    const key = `freelancer_portfolio:${userId}`;
    await prisma.setting.upsert({
        where: { key },
        update: { value: jsonStr, category: "freelancer_portfolio" },
        create: { key, value: jsonStr, category: "freelancer_portfolio" },
    });
}
function profileCompletion(user, profile) {
    const personalScore = pct(filled(user.fullName, user.email, user.phone, user.avatarUrl, user.city || user.country, user.bio), 6);
    const professionalScore = pct(filled(profile?.industry, profile?.skills, profile?.hourlyRate, profile?.experience, user.bio), 5);
    const portfolioItems = parsePortfolioJson(profile?.portfolioJson);
    const publishedLike = portfolioItems.filter((p) => ["Published", "Featured", "Case Study"].includes(p.status)).length;
    const portfolioScore = portfolioItems.length === 0
        ? 0
        : Math.min(100, Math.round((publishedLike / Math.max(portfolioItems.length, 1)) * 70 + Math.min(portfolioItems.length, 5) * 6));
    const resumeScore = user.bio && String(user.bio).length > 40 ? 100 : user.bio ? 60 : 20;
    const items = [
        { label: "Personal Info", pct: personalScore },
        { label: "Professional Info", pct: professionalScore },
        { label: "Portfolio", pct: portfolioScore },
        { label: "Resume", pct: resumeScore },
    ];
    const overall = Math.round(items.reduce((s, i) => s + i.pct, 0) / items.length);
    return { overall, items };
}
function relativeTime(date) {
    const diffMs = Date.now() - date.getTime();
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
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function freelancerNotifScope(userId) {
    return {
        status: { notIn: ["cancelled", "draft"] },
        OR: [
            { userId },
            { AND: [{ userId: null }, { role: "freelancer" }] },
            { AND: [{ userId: null }, { OR: [{ role: null }, { role: "" }] }] },
        ],
    };
}
function isNotifUnread(n) {
    return !n.readAt && String(n.status || "").toLowerCase() !== "read";
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
function titleCaseType(type) {
    return String(type || "system")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
function statusLabel(status) {
    const s = String(status || "").toLowerCase().replace(/_/g, " ");
    if (s === "in progress" || s === "active")
        return "In Progress";
    if (s === "completed" || s === "delivered")
        return "Delivered";
    if (s === "review")
        return "Review";
    if (s === "shortlisted")
        return "Shortlisted";
    if (s === "interview")
        return "Interview";
    if (s === "pending" || s === "viewed")
        return s === "viewed" ? "Viewed" : "Pending";
    if (s === "in review")
        return "In Review";
    return status
        ? status
            .split(/[_\s]+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ")
        : "Open";
}
function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}
function endOfToday() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
}
function isDueToday(dueDate) {
    if (!dueDate)
        return false;
    const raw = String(dueDate).trim();
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const t0 = startOfToday().getTime();
        const t1 = endOfToday().getTime();
        return parsed.getTime() >= t0 && parsed.getTime() <= t1;
    }
    // YYYY-MM-DD
    const iso = raw.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return iso === today;
}
const safeFreelancerProfileSelect = {
    select: {
        id: true,
        userId: true,
        industry: true,
        skills: true,
        hourlyRate: true,
        rating: true,
        experience: true,
        createdAt: true,
        updatedAt: true,
    },
};
export const getFreelancerDashboard = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const userId = req.user.id;
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: {
                freelancerProfile: safeFreelancerProfileSelect,
                wallet: true,
            },
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const [proposalsAll, proposalsPending, contractsAll, contractsActive, contractsCompleted, reviews, openProjects, tasksAssigned, unreadNotifications, walletCredits, recentProposals, recentContracts, recentCreditTx, notificationRows, walletTxRows, openProjectRows, allProposals, reviewRows,] = await Promise.all([
            prisma.proposal.count({ where: { freelancerId: userId, deletedAt: null } }),
            prisma.proposal.count({
                where: {
                    freelancerId: userId,
                    deletedAt: null,
                    status: { in: ["pending", "shortlisted", "interview", "in_review", "viewed"] },
                },
            }),
            prisma.contract.count({ where: { freelancerId: userId, deletedAt: null } }),
            prisma.contract.count({
                where: {
                    freelancerId: userId,
                    deletedAt: null,
                    status: { in: ["active", "pending_acceptance", "draft"] },
                },
            }),
            prisma.contract.count({
                where: { freelancerId: userId, deletedAt: null, status: "completed" },
            }),
            prisma.review.findMany({
                where: { revieweeId: userId },
                select: { rating: true },
            }),
            prisma.project.count({ where: { status: { in: ["open", "approved", "active", "Published", "Open", "Approved", "Active"] }, deletedAt: null } }),
            prisma.task.findMany({
                where: {
                    deletedAt: null,
                    status: { notIn: ["done", "completed", "cancelled"] },
                    OR: [{ assignedTo: userId }, { assignedTo: user.fullName }, { assignedTo: user.email }],
                },
                select: { id: true, title: true, priority: true, dueDate: true, status: true, progress: true },
                take: 50,
            }),
            prisma.notification.count({
                where: {
                    ...freelancerNotifScope(userId),
                    readAt: null,
                    NOT: { status: "read" },
                },
            }),
            user.wallet
                ? prisma.walletTransaction.aggregate({
                    where: { walletId: user.wallet.id, direction: "credit" },
                    _sum: { amount: true },
                })
                : Promise.resolve({ _sum: { amount: 0 } }),
            prisma.proposal.findMany({
                where: { freelancerId: userId, deletedAt: null },
                include: { project: true },
                orderBy: { createdAt: "desc" },
                take: 5,
            }),
            prisma.contract.findMany({
                where: { freelancerId: userId, deletedAt: null },
                include: {
                    project: true,
                    client: { select: { fullName: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 8,
            }),
            user.wallet
                ? prisma.walletTransaction.findMany({
                    where: { walletId: user.wallet.id, direction: "credit" },
                    orderBy: { createdAt: "desc" },
                    take: 200,
                })
                : Promise.resolve([]),
            prisma.notification.findMany({
                where: freelancerNotifScope(userId),
                orderBy: { createdAt: "desc" },
                take: 12,
            }),
            user.wallet
                ? prisma.walletTransaction.findMany({
                    where: { walletId: user.wallet.id },
                    orderBy: { createdAt: "desc" },
                    take: 50,
                })
                : Promise.resolve([]),
            prisma.project.findMany({
                where: { status: { in: ["open", "approved", "active", "Published", "Open", "Approved", "Active"] }, deletedAt: null },
                orderBy: { createdAt: "desc" },
                take: 24,
            }),
            prisma.proposal.findMany({
                where: { freelancerId: userId, deletedAt: null },
                include: { project: true },
                orderBy: { createdAt: "desc" },
                take: 40,
            }),
            prisma.review.findMany({
                where: { revieweeId: userId },
                include: {
                    reviewer: { select: { fullName: true, avatarUrl: true } },
                    project: { select: { title: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            }),
        ]);
        const reviewCount = reviews.length;
        const avgRating = reviewCount > 0
            ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviewCount) * 100) / 100
            : Number(user.freelancerProfile?.rating ?? 0) || 0;
        const decidedContracts = contractsCompleted + contractsActive;
        const jobSuccess = decidedContracts > 0
            ? Math.min(100, Math.round((contractsCompleted / decidedContracts) * 100) || (user.isVerified || user.verified ? 95 : 0))
            : user.isVerified || user.verified
                ? 100
                : avgRating >= 4
                    ? Math.round((avgRating / 5) * 100)
                    : 0;
        const completion = profileCompletion(user, user.freelancerProfile);
        const balance = Number(user.wallet?.balance ?? 0);
        const currency = user.wallet?.currency || "USD";
        const totalEarnings = Number(walletCredits._sum.amount ?? 0);
        const tasksDueToday = tasksAssigned.filter((t) => isDueToday(t.dueDate));
        const highPriorityToday = tasksDueToday.filter((t) => ["high", "urgent"].includes(String(t.priority || "").toLowerCase())).length;
        // Response rate approx: non-pending / all proposals
        const responseRate = proposalsAll > 0 ? Math.round(((proposalsAll - proposalsPending) / proposalsAll) * 100) : 0;
        // Monthly earnings series from wallet credits (last 12 months)
        const now = new Date();
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
                month: d.toLocaleString("en-US", { month: "short" }),
                earnings: 0,
                proposals: 0,
            });
        }
        for (const tx of recentCreditTx) {
            const d = new Date(tx.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const bucket = months.find((m) => m.key === key);
            if (bucket)
                bucket.earnings += Number(tx.amount || 0);
        }
        const allProposalDates = await prisma.proposal.findMany({
            where: {
                freelancerId: userId,
                deletedAt: null,
                createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
            },
            select: { createdAt: true },
        });
        for (const p of allProposalDates) {
            const d = new Date(p.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const bucket = months.find((m) => m.key === key);
            if (bucket)
                bucket.proposals += 1;
        }
        const earningsSeries = months.map(({ month, earnings, proposals }) => ({
            month,
            earnings: Math.round(earnings),
            proposals,
        }));
        // Skill distribution from comma-separated skills
        const skillsRaw = String(user.freelancerProfile?.skills || "")
            .split(/[,|]/)
            .map((s) => s.trim())
            .filter(Boolean);
        const skillDist = skillsRaw.length > 0
            ? skillsRaw.slice(0, 5).map((name, i, arr) => ({
                name,
                value: Math.max(8, Math.round(100 / arr.length) - i),
            }))
            : [];
        // Collect all client IDs/names that look like UUIDs
        const clientIds = new Set();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const addIfUuid = (val) => {
            if (typeof val === 'string' && uuidRegex.test(val)) {
                clientIds.add(val);
            }
        };
        allProposals.forEach(p => {
            if (p.project?.client)
                addIfUuid(p.project.client);
        });
        recentProposals.forEach(p => {
            if (p.project?.client)
                addIfUuid(p.project.client);
        });
        openProjectRows.forEach(p => {
            if (p.client)
                addIfUuid(p.client);
        });
        recentContracts.forEach(c => {
            if (c.project?.client)
                addIfUuid(c.project.client);
        });
        const clientMap = new Map();
        if (clientIds.size > 0) {
            const users = await prisma.user.findMany({
                where: { id: { in: Array.from(clientIds) } },
                select: { id: true, fullName: true },
            });
            users.forEach(u => {
                if (u.fullName) {
                    clientMap.set(u.id, u.fullName);
                }
            });
        }
        const resolveClientName = (clientVal) => {
            if (!clientVal)
                return "Client";
            if (clientMap.has(clientVal)) {
                return clientMap.get(clientVal) || "Client";
            }
            return clientVal;
        };
        const recentProjects = recentContracts.map((c) => {
            const project = c.project;
            const progress = String(c.status).toLowerCase() === "completed"
                ? 100
                : String(c.status).toLowerCase() === "active"
                    ? 55
                    : 25;
            return {
                id: c.contractNumber || c.id.slice(0, 8).toUpperCase(),
                title: project?.title || "Untitled project",
                client: c.client?.fullName || resolveClientName(project?.client),
                budget: money(Number(project?.budget ?? 0), currency),
                status: statusLabel(project?.status || c.status),
                due: project?.timeline || "—",
                progress,
            };
        });
        const proposalRows = recentProposals.map((p) => ({
            id: `PRO-${p.id.slice(0, 4).toUpperCase()}`,
            project: p.project?.title || "Project",
            sent: relativeTime(p.createdAt),
            bid: money(Number(p.bidAmount ?? 0), currency),
            status: statusLabel(p.status),
        }));
        const firstName = (user.fullName || "there").split(" ")[0];
        const availability = user.status === "active" ? "Available for work" : "Unavailable";
        const kpis = [
            {
                key: "earnings",
                label: "Total Earnings",
                value: money(totalEarnings, currency),
                delta: totalEarnings > 0 ? "Lifetime credits" : "No earnings yet",
                trend: totalEarnings > 0 ? "up" : "flat",
                accent: "primary",
            },
            {
                key: "balance",
                label: "Available Balance",
                value: money(balance, currency),
                delta: balance > 0 ? "Ready to withdraw" : "Wallet empty",
                trend: "flat",
                accent: "success",
            },
            {
                key: "won",
                label: "Projects Won",
                value: String(contractsCompleted),
                delta: `${contractsActive} active now`,
                trend: contractsCompleted > 0 ? "up" : "flat",
                accent: "info",
            },
            {
                key: "active",
                label: "Contracts Active",
                value: String(contractsActive),
                delta: contractsActive ? "In delivery" : "No active contracts",
                trend: contractsActive ? "up" : "flat",
                accent: "warning",
            },
            {
                key: "proposals",
                label: "Pending Proposals",
                value: String(proposalsPending),
                delta: proposalsAll ? `${responseRate}% settled rate` : "No proposals yet",
                trend: "flat",
                accent: "info",
            },
            {
                key: "tasks",
                label: "Tasks Due Today",
                value: String(tasksDueToday.length),
                delta: highPriorityToday ? `${highPriorityToday} high priority` : "None urgent",
                trend: tasksDueToday.length ? "flat" : "up",
                accent: "danger",
            },
            {
                key: "meetings",
                label: "Meetings Today",
                value: "0",
                delta: "No meetings scheduled",
                trend: "flat",
                accent: "primary",
            },
            {
                key: "rating",
                label: "Average Rating",
                value: avgRating ? avgRating.toFixed(2) : "—",
                delta: `${reviewCount} review${reviewCount === 1 ? "" : "s"}`,
                trend: avgRating >= 4 ? "up" : "flat",
                accent: "success",
            },
        ];
        const aiSuggestions = [
            openProjects > 0
                ? {
                    title: `${openProjects} open project${openProjects === 1 ? "" : "s"} available to bid on`,
                    cta: "Browse matches",
                }
                : { title: "Complete your profile to unlock better project matches", cta: "Update profile" },
            completion.overall < 90
                ? {
                    title: `Your profile is ${completion.overall}% complete — finish the last sections`,
                    cta: "Complete profile",
                }
                : { title: "Your profile looks strong — keep winning clients", cta: "View analytics" },
            proposalsPending > 0
                ? {
                    title: `Follow up on ${proposalsPending} pending proposal${proposalsPending === 1 ? "" : "s"}`,
                    cta: "Open proposals",
                }
                : { title: "Send a proposal today to keep your pipeline warm", cta: "Find projects" },
        ];
        res.json({
            success: true,
            data: {
                profile: {
                    id: user.id,
                    name: user.fullName,
                    firstName,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatarUrl || null,
                    bio: user.bio || "",
                    headline: user.freelancerProfile?.industry
                        ? `${user.freelancerProfile.experience || "Freelancer"} · ${user.freelancerProfile.industry}`
                        : user.bio?.slice(0, 80) || "Freelancer",
                    industry: user.freelancerProfile?.industry || null,
                    experience: user.freelancerProfile?.experience || null,
                    skills: skillsRaw,
                    location: [user.city, user.country].filter(Boolean).join(", ") || null,
                    hourlyRate: user.freelancerProfile?.hourlyRate ?? null,
                    jobSuccess,
                    rating: avgRating,
                    reviews: reviewCount,
                    completionPct: completion.overall,
                    online: true,
                    availability,
                    verified: Boolean(user.isVerified || user.verified),
                    role: user.role,
                },
                kpis,
                hero: {
                    matches: openProjects,
                    withdrawable: money(balance, currency),
                    withdrawableRaw: balance,
                    pendingProposals: proposalsPending,
                    profileViewsThisWeek: 0,
                    profileViewsDeltaPct: 0,
                },
                profileCompletion: completion.items,
                earningsSeries,
                skillDist,
                recentProjects,
                recentProposals: proposalRows,
                upcomingMeetings: [],
                messages: [],
                aiSuggestions,
                notifications: notificationRows.map(mapNotifRow), wallet: {
                    balance,
                    currency,
                    totalEarnings,
                    available: balance,
                    pending: 0,
                    bonus: 0,
                    referral: 0,
                    cashback: 0,
                    transactions: walletTxRows.map((t) => ({
                        id: t.id.slice(0, 8).toUpperCase(),
                        type: t.direction === "credit" ? "Credit" : "Debit",
                        credit: t.direction === "credit" ? Number(t.amount) : 0,
                        debit: t.direction === "debit" ? Number(t.amount) : 0,
                        gateway: t.type || "Wallet",
                        ref: t.description || "—",
                        status: "Completed",
                        date: t.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                    })),
                },
                openProjects: openProjectRows.map((p) => ({
                    id: p.id,
                    title: p.title,
                    client: resolveClientName(p.client),
                    budget: money(Number(p.budget || 0), currency),
                    budgetRaw: Number(p.budget || 0),
                    category: p.category,
                    technology: p.technology,
                    timeline: p.timeline || "—",
                    status: statusLabel(p.status),
                    createdAt: p.createdAt,
                })),
                proposals: allProposals.map((p) => ({
                    id: p.id,
                    ref: `PRO-${p.id.slice(0, 4).toUpperCase()}`,
                    project: p.project?.title || "Project",
                    client: resolveClientName(p.project?.client),
                    sent: relativeTime(p.createdAt),
                    bid: money(Number(p.bidAmount ?? 0), currency),
                    bidRaw: Number(p.bidAmount ?? 0),
                    status: statusLabel(p.status),
                    coverLetter: p.coverLetter || "",
                })),
                reviewsList: reviewRows.map((r) => ({
                    id: r.id,
                    rating: Number(r.rating),
                    comment: r.comment || "",
                    reviewer: r.reviewer?.fullName || "Client",
                    avatar: r.reviewer?.avatarUrl || null,
                    project: r.project?.title || "Project",
                    date: relativeTime(r.createdAt),
                })),
                counts: {
                    notifications: unreadNotifications,
                    projects: contractsActive,
                    proposals: proposalsPending,
                    messages: 0,
                    openProjects,
                },
                meta: {
                    currency,
                    totalProjects: contractsAll,
                    totalProposals: proposalsAll,
                    totalEarnings,
                    balance,
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
function parseSkills(raw) {
    if (Array.isArray(raw)) {
        return raw.map((s) => String(s || "").trim()).filter(Boolean);
    }
    return String(raw || "")
        .split(/[,|;]/)
        .map((s) => s.trim())
        .filter(Boolean);
}
function splitLocation(location) {
    const raw = String(location || "").trim();
    if (!raw)
        return { city: null, country: null };
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1)
        return { city: parts[0], country: null };
    return { city: parts[0], country: parts.slice(1).join(", ") };
}
export const getFreelancerProfile = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const user = await prisma.user.findFirst({
            where: { id: req.user.id, deletedAt: null },
            include: { freelancerProfile: safeFreelancerProfileSelect },
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const profile = user.freelancerProfile;
        const skills = parseSkills(profile?.skills);
        const completion = profileCompletion(user, profile);
        const location = [user.city, user.country].filter(Boolean).join(", ");
        const headline = (user.bio && user.bio.trim()) ||
            (profile?.industry
                ? `${profile.experience || "Freelancer"} · ${profile.industry}`
                : "Freelancer");
        res.json({
            success: true,
            data: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone || "",
                avatarUrl: user.avatarUrl || "",
                bio: user.bio || "",
                headline,
                title: profile?.industry || "",
                industry: profile?.industry || "",
                experience: profile?.experience || "",
                skills,
                skillsText: skills.join(", "),
                hourlyRate: profile?.hourlyRate ?? null,
                city: user.city || "",
                country: user.country || "",
                location,
                availability: user.status === "active" ? "Available for work" : "Unavailable",
                status: user.status,
                verified: Boolean(user.isVerified || user.verified),
                role: user.role,
                completionPct: completion.overall,
                profileCompletion: completion.items,
                rating: Number(profile?.rating ?? 0) || 0,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const updateFreelancerProfile = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const body = req.body || {};
        const userId = req.user.id;
        const existing = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { freelancerProfile: safeFreelancerProfileSelect },
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const fullName = body.fullName != null ? String(body.fullName).trim() : existing.fullName;
        if (!fullName) {
            return res.status(400).json({ success: false, message: "Full name is required" });
        }
        const cityIn = body.city != null ? String(body.city).trim() : "";
        const countryIn = body.country != null ? String(body.country).trim() : "";
        const locationIn = body.location != null ? String(body.location).trim() : "";
        let loc = {
            city: existing.city,
            country: existing.country,
        };
        if (cityIn || countryIn) {
            loc = {
                city: cityIn || existing.city,
                country: countryIn || existing.country,
            };
        }
        else if (locationIn) {
            loc = splitLocation(locationIn);
        }
        // Headline maps to bio when bio not explicitly sent; bio wins if both provided.
        let bio = existing.bio;
        if (body.bio != null)
            bio = String(body.bio);
        else if (body.headline != null)
            bio = String(body.headline);
        const avatarUrl = body.avatarUrl != null ? String(body.avatarUrl).trim() || null : existing.avatarUrl;
        const phone = body.phone != null ? String(body.phone).trim() || null : existing.phone;
        let status = existing.status;
        if (body.status != null) {
            status = String(body.status).trim() || existing.status;
        }
        else if (body.availability != null) {
            const a = String(body.availability).toLowerCase();
            if (a.includes("unavailable") || a.includes("not available"))
                status = "inactive";
            else if (a.includes("available"))
                status = "active";
        }
        await prisma.user.update({
            where: { id: userId },
            data: {
                fullName,
                phone,
                bio,
                avatarUrl,
                city: loc.city,
                country: loc.country,
                status,
            },
        });
        const industry = body.title != null
            ? String(body.title).trim() || null
            : body.industry != null
                ? String(body.industry).trim() || null
                : existing.freelancerProfile?.industry ?? null;
        const experience = body.experience != null
            ? String(body.experience).trim() || null
            : existing.freelancerProfile?.experience ?? null;
        const skillsArr = body.skills != null || body.skillsText != null
            ? parseSkills(body.skills ?? body.skillsText)
            : parseSkills(existing.freelancerProfile?.skills);
        const hourlyRateRaw = body.hourlyRate;
        let hourlyRate = existing.freelancerProfile?.hourlyRate ?? null;
        if (hourlyRateRaw != null && hourlyRateRaw !== "") {
            const n = Number(String(hourlyRateRaw).replace(/[^0-9.]/g, ""));
            hourlyRate = Number.isFinite(n) ? n : null;
        }
        await prisma.freelancerProfile.upsert({
            where: { userId },
            update: {
                industry,
                experience,
                skills: skillsArr.join(", "),
                hourlyRate,
            },
            create: {
                userId,
                industry,
                experience,
                skills: skillsArr.join(", "),
                hourlyRate,
            },
        });
        // Return fresh profile using same shape as GET
        req.user = { ...req.user, id: userId };
        return getFreelancerProfile(req, res, next);
    }
    catch (err) {
        next(err);
    }
};
export const listFreelancerNotifications = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const userId = req.user.id;
        const filter = String(req.query.filter || "all").toLowerCase();
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 50));
        const rows = await prisma.notification.findMany({
            where: freelancerNotifScope(userId),
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
                .map(([key, count]) => ({
                key: `type:${key}`,
                label: titleCaseType(key),
                count,
            })),
        ];
        res.json({
            success: true,
            data: items,
            items,
            filters,
            filter,
            unreadCount,
            importantCount,
            total,
            page,
            pageSize,
        });
    }
    catch (err) {
        next(err);
    }
};
export const markFreelancerNotificationRead = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { id } = req.params;
        const existing = await prisma.notification.findFirst({
            where: { id, ...freelancerNotifScope(req.user.id) },
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }
        const updated = await prisma.notification.update({
            where: { id },
            data: { status: "read", readAt: new Date() },
        });
        res.json({ success: true, data: mapNotifRow(updated) });
    }
    catch (err) {
        next(err);
    }
};
export const markAllFreelancerNotificationsRead = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const result = await prisma.notification.updateMany({
            where: {
                ...freelancerNotifScope(req.user.id),
                readAt: null,
                NOT: { status: "read" },
            },
            data: { status: "read", readAt: new Date() },
        });
        res.json({
            success: true,
            message: "All notifications marked as read",
            data: { updated: result.count },
        });
    }
    catch (err) {
        next(err);
    }
};
const VERIFICATION_KEYS = [
    { key: "email", label: "Email address", required: true },
    { key: "phone", label: "Phone number", required: true },
    { key: "identity", label: "Identity (Government ID)", required: true },
    { key: "passport", label: "Passport", required: false },
    { key: "driving", label: "Driving License", required: false },
    { key: "gst", label: "GST (Optional)", required: false },
    { key: "address", label: "Address proof", required: true },
    { key: "selfie", label: "Selfie verification", required: true },
];
function parseVerificationJson(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
function buildVerificationItems(user, stored) {
    const location = [user.city, user.country].filter(Boolean).join(", ");
    const accountVerified = Boolean(user.isVerified || user.verified);
    return VERIFICATION_KEYS.map(({ key, label, required }) => {
        const fromStore = stored[key] || {};
        let status = fromStore.status || "missing";
        let value = String(fromStore.value || "").trim();
        const documentUrl = fromStore.documentUrl || null;
        if (key === "email") {
            value = user.email || value || "Not set";
            status = user.email ? "verified" : "missing";
        }
        else if (key === "phone") {
            value = user.phone || value || "Not submitted";
            status = user.phone ? fromStore.status || "verified" : "missing";
        }
        else if (key === "identity") {
            if (!value)
                value = accountVerified ? "Account verified by admin" : "Not submitted";
            if (accountVerified && status === "missing")
                status = "verified";
        }
        else if (key === "address") {
            if (!value && location) {
                value = location;
                status = status === "missing" ? "pending" : status;
            }
            if (!value)
                value = "Not submitted";
        }
        else if (!value) {
            value = status === "missing" ? "Not submitted" : value || "Submitted";
        }
        if (!["verified", "pending", "missing"].includes(status))
            status = "missing";
        return {
            key,
            label,
            value,
            status,
            documentUrl,
            required: Boolean(required),
        };
    });
}
export const getFreelancerVerification = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const user = await prisma.user.findFirst({
            where: { id: req.user.id, deletedAt: null },
            include: { freelancerProfile: safeFreelancerProfileSelect },
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const stored = parseVerificationJson(user.freelancerProfile?.verificationJson);
        const items = buildVerificationItems(user, stored);
        const verifiedCount = items.filter((i) => i.status === "verified").length;
        const pendingCount = items.filter((i) => i.status === "pending").length;
        const missingCount = items.filter((i) => i.status === "missing").length;
        const requiredItems = items.filter((i) => i.required);
        const requiredVerified = requiredItems.filter((i) => i.status === "verified").length;
        const trustScore = Math.round((verifiedCount / Math.max(items.length, 1)) * 100);
        res.json({
            success: true,
            data: {
                items,
                trustScore,
                verifiedCount,
                pendingCount,
                missingCount,
                requiredVerified,
                requiredTotal: requiredItems.length,
                accountVerified: Boolean(user.isVerified || user.verified),
                fullName: user.fullName,
                email: user.email,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const updateFreelancerVerification = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const userId = req.user.id;
        const body = req.body || {};
        const key = String(body.key || "").trim().toLowerCase();
        if (!key || !VERIFICATION_KEYS.some((k) => k.key === key)) {
            return res.status(400).json({ success: false, message: "Invalid verification key" });
        }
        if (key === "email") {
            return res.status(400).json({ success: false, message: "Email is verified via your account email" });
        }
        const user = await prisma.user.findFirst({
            where: { id: userId, deletedAt: null },
            include: { freelancerProfile: safeFreelancerProfileSelect },
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const stored = parseVerificationJson(user.freelancerProfile?.verificationJson);
        const nextStatusRaw = body.status != null ? String(body.status).toLowerCase() : "pending";
        const nextStatus = ["verified", "pending", "missing"].includes(nextStatusRaw)
            ? nextStatusRaw
            : "pending";
        const value = body.value != null
            ? String(body.value).trim()
            : stored[key]?.value || (nextStatus === "missing" ? "Not submitted" : "Submitted for review");
        stored[key] = {
            ...stored[key],
            key,
            label: VERIFICATION_KEYS.find((k) => k.key === key)?.label,
            value,
            status: nextStatus,
            documentUrl: body.documentUrl != null ? String(body.documentUrl).trim() || null : stored[key]?.documentUrl || null,
        };
        // Phone can sync to user.phone when provided
        if (key === "phone" && body.value) {
            await prisma.user.update({
                where: { id: userId },
                data: { phone: String(body.value).trim() },
            });
            if (nextStatus === "missing")
                stored[key].status = "pending";
        }
        await prisma.freelancerProfile.upsert({
            where: { userId },
            update: { verificationJson: JSON.stringify(stored) },
            create: {
                userId,
                verificationJson: JSON.stringify(stored),
            },
        });
        return getFreelancerVerification(req, res, next);
    }
    catch (err) {
        next(err);
    }
};
export const getFreelancerPortfolio = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { items } = await loadPortfolioItems(req.user.id);
        res.json({
            success: true,
            data: {
                items,
                kpis: portfolioKpis(items),
                statuses: [...PORTFOLIO_STATUSES],
                counts: {
                    all: items.length,
                    gallery: items.filter((i) => ["Published", "Featured", "Case Study"].includes(i.status)).length,
                    caseStudies: items.filter((i) => i.status === "Case Study").length,
                    live: items.filter((i) => ["Published", "Featured"].includes(i.status)).length,
                    drafts: items.filter((i) => i.status === "Draft").length,
                    archived: items.filter((i) => i.status === "Archived").length,
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const getFreelancerPortfolioItem = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, message: "Portfolio item ID is required" });
        }
        const { items } = await loadPortfolioItems(req.user.id);
        const item = items.find((p) => p.id === id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Portfolio item not found" });
        }
        res.json({
            success: true,
            data: item,
        });
    }
    catch (err) {
        next(err);
    }
};
export const createFreelancerPortfolioItem = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const body = req.body || {};
        const title = String(body.title || "").trim();
        if (!title) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }
        const { items } = await loadPortfolioItems(req.user.id);
        const id = `PF-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, "0")}`;
        const item = normalizePortfolioItem({ ...body, title, id, created: new Date().toISOString().slice(0, 10) }, id);
        const next = [item, ...items];
        await savePortfolioItems(req.user.id, next);
        res.status(201).json({
            success: true,
            message: "Portfolio item created",
            data: {
                item,
                items: next,
                kpis: portfolioKpis(next),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const updateFreelancerPortfolioItem = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ success: false, message: "Missing portfolio item id" });
        }
        const { items } = await loadPortfolioItems(req.user.id);
        const idx = items.findIndex((i) => i.id === id);
        if (idx < 0) {
            return res.status(404).json({ success: false, message: "Portfolio item not found" });
        }
        const body = req.body || {};
        const merged = normalizePortfolioItem({
            ...items[idx],
            ...body,
            id,
            created: items[idx].created,
            title: body.title != null ? String(body.title).trim() : items[idx].title,
        }, id);
        if (!merged.title) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }
        const next = [...items];
        next[idx] = merged;
        await savePortfolioItems(req.user.id, next);
        res.json({
            success: true,
            message: "Portfolio item updated",
            data: {
                item: merged,
                items: next,
                kpis: portfolioKpis(next),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const deleteFreelancerPortfolioItem = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const id = String(req.params.id || "").trim();
        if (!id) {
            return res.status(400).json({ success: false, message: "Missing portfolio item id" });
        }
        const { items } = await loadPortfolioItems(req.user.id);
        if (!items.some((i) => i.id === id)) {
            return res.status(404).json({ success: false, message: "Portfolio item not found" });
        }
        const next = items.filter((i) => i.id !== id);
        await savePortfolioItems(req.user.id, next);
        res.json({
            success: true,
            message: "Portfolio item deleted",
            data: {
                items: next,
                kpis: portfolioKpis(next),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
