import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { logActivityEvent } from "../../services/activity/activity.service.js";

function money(n: number, currency = "USD") {
  const value = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency === "INR" ? "INR" : "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function filled(...values: Array<unknown>) {
  return values.filter((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (typeof v === "number") return Number.isFinite(v);
    if (typeof v === "boolean") return true;
    return Boolean(v);
  }).length;
}

type PortfolioItem = {
  id: string;
  title: string;
  thumb: string;
  category: string;
  categoryId?: string;
  tech: string;
  skills?: any[];
  industry: string;
  industryId?: string;
  client: string;
  duration: string;
  team: number;
  teamSize?: string;
  teamSizeId?: string;
  role: string;
  status: string;
  views: number;
  likes: number;
  shares: number;
  created: string;
  overview?: string;
  challenge?: string;
  solution?: string;
  impact?: string;
  githubUrl?: string;
  liveUrl?: string;
  pdfUrl?: string;
  pdfCaseStudy?: string;
  videoUrl?: string;
  videoDemo?: string;
  coverMedia?: string;
  extraScreenshot?: string;
  gallery?: string[];
};

const PORTFOLIO_STATUSES = ["Published", "Featured", "Case Study", "Draft", "Archived"] as const;

function parsePortfolioJson(raw: string | null | undefined): PortfolioItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x: any) => normalizePortfolioItem(x))
      .filter((x) => Boolean(x.id && x.title));
  } catch {
    return [];
  }
}

function normalizePortfolioItem(input: any, fallbackId?: string): PortfolioItem {
  const statusRaw = String(input?.status || "Draft").trim();
  const status = (PORTFOLIO_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "Draft";
  const gallery = Array.isArray(input?.gallery)
    ? input.gallery.map(String).filter(Boolean)
    : typeof input?.gallery === "string" && input.gallery.trim()
      ? input.gallery.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

  const skills = Array.isArray(input?.skills) ? input.skills : [];
  let tech = String(input?.tech || "").trim();
  if (!tech && skills.length > 0) {
    tech = skills.map((s: any) => s.skillName || s.name || s).join(", ");
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
    challenge: input?.challenge != null ? String(input.challenge) : "",
    solution: input?.solution != null ? String(input.solution) : "",
    impact: input?.impact != null ? String(input.impact) : "",
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

function portfolioKpis(items: PortfolioItem[]) {
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

async function loadPortfolioItems(userId: string): Promise<{ items: PortfolioItem[]; profileId: string | null }> {
  const profile = await prisma.freelancerProfile.findUnique({ where: { userId } });
  const setting = await prisma.setting.findUnique({ where: { key: `freelancer_portfolio:${userId}` } });
  
  let items = parsePortfolioJson((profile as any)?.portfolioJson);
  
  if (items.length === 0 && setting?.value) {
    items = parsePortfolioJson(setting.value);
  }

  if (items.length === 0) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let regData: any = {};
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

async function savePortfolioItems(userId: string, items: PortfolioItem[]) {
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

function profileCompletion(user: any, profile: any) {
  const hasText = (v: any) => typeof v === 'string' && v.trim().length > 0;
  const hasNumber = (v: any) => typeof v === 'number' && !isNaN(v);
  const fp = profile;
  const steps = {
    personal_info:       hasText(user.fullName) && hasText(user.email),
    professional_info:   hasText(user.bio) && (hasText(fp?.titleHeadline) || hasText(user.bio)),
    skills:              hasText(fp?.skills),
    experience:          hasText(fp?.experience) || hasNumber(fp?.hourlyRate),
    portfolio:           hasText(fp?.portfolioUrl) || hasText(fp?.linkedInUrl) || hasText(fp?.githubUrl) || hasText(fp?.dribbbleUrl),
    avatar:              hasText(user.avatarUrl),
    location:            hasText(user.city) || hasText(user.country),
    resume:              hasText(fp?.resumeUrl),
  };

  const p1 = (steps.personal_info ? 1 : 0) + (steps.avatar ? 1 : 0) + (steps.location ? 1 : 0);
  const personalScore = Math.round((p1 / 3) * 100);
  
  const p2 = (steps.professional_info ? 1 : 0) + (steps.skills ? 1 : 0) + (steps.experience ? 1 : 0);
  const professionalScore = Math.round((p2 / 3) * 100);
  
  const portfolioScore = steps.portfolio ? 100 : 0;
  const resumeScore = steps.resume ? 100 : 0;

  const items = [
    { label: "Personal Info", pct: personalScore },
    { label: "Professional Info", pct: professionalScore },
    { label: "Portfolio", pct: portfolioScore },
    { label: "Resume", pct: resumeScore },
  ];
  
  const completedCount = Object.values(steps).filter(Boolean).length;
  const overall = Math.round((completedCount / 8) * 100);
  
  return { overall, items };
}

function relativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function freelancerNotifScope(userId: string) {
  return {
    status: { notIn: ["cancelled", "draft"] },
    OR: [
      { userId },
      { AND: [{ userId: null }, { role: "freelancer" }] },
      { AND: [{ userId: null }, { OR: [{ role: null }, { role: "" }] }] },
    ],
  };
}

function isNotifUnread(n: { readAt: Date | null; status: string }) {
  return !n.readAt && String(n.status || "").toLowerCase() !== "read";
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

function titleCaseType(type: string) {
  return String(type || "system")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusLabel(status: string) {
  const s = String(status || "").toLowerCase().replace(/_/g, " ");
  if (s === "in progress" || s === "active") return "In Progress";
  if (s === "completed" || s === "delivered") return "Delivered";
  if (s === "review") return "Review";
  if (s === "shortlisted") return "Shortlisted";
  if (s === "interview") return "Interview";
  if (s === "pending" || s === "viewed") return s === "viewed" ? "Viewed" : "Pending";
  if (s === "in review") return "In Review";
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

function isDueToday(dueDate: string | null | undefined) {
  if (!dueDate) return false;
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
    titleHeadline: true,
    industry: true,
    skills: true,
    hourlyRate: true,
    rating: true,
    experience: true,
    currency: true,
    monthlyRetainer: true,
    availability: true,
    workingHours: true,
    responseTime: true,
    remoteAvailability: true,
    openToTravel: true,
    createdAt: true,
    updatedAt: true,
  },
};

export const getFreelancerDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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

    const [
      proposalsAll,
      proposalsPending,
      contractsAll,
      contractsActive,
      contractsCompleted,
      reviews,
      openProjects,
      tasksAssigned,
      unreadNotifications,
      walletCredits,
      recentProposals,
      recentContracts,
      recentCreditTx,
      notificationRows,
      walletTxRows,
      openProjectRows,
      allProposals,
      reviewRows,
      unreadMessages,
    ] = await Promise.all([
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
      prisma.project.count({ where: { status: { in: ["open", "approved", "active", "Published", "Open", "Approved", "Active", "closed", "Closed", "completed", "Completed"] }, deletedAt: null } }),
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
        where: { status: { in: ["open", "approved", "active", "Published", "Open", "Approved", "Active", "closed", "Closed", "completed", "Completed"] }, deletedAt: null },
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
      prisma.message.count({
        where: {
          conversation: { OR: [{ userA: userId }, { userB: userId }] },
          senderId: { not: userId },
          readAt: null,
        }
      }),
    ]);

    const reviewCount = reviews.length;
    const avgRating =
      reviewCount > 0
        ? Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviewCount) * 100) / 100
        : Number(user.freelancerProfile?.rating ?? 0) || 0;

    const decidedContracts = contractsCompleted + contractsActive;
    const jobSuccess =
      decidedContracts > 0
        ? Math.min(100, Math.round((contractsCompleted / decidedContracts) * 100) || (user.isVerified || user.verified ? 95 : 0))
        : user.isVerified || user.verified
          ? 100
          : avgRating >= 4
            ? Math.round((avgRating / 5) * 100)
            : 0;

    const completion: any = profileCompletion(user, user.freelancerProfile);
    try {
      const { resolveProfileCompletion } = await import("../../services/mobile/profile-completion.service.js");
      const realCompletion = await resolveProfileCompletion(user.id);
      completion.overall = realCompletion.profileCompletion;
      completion.readinessEngine = {
        profileLevel: realCompletion.profileLevel,
        operationalReady: realCompletion.operationalReady,
        requirements: realCompletion.requirements,
        verification: realCompletion.verification,
        capabilities: realCompletion.capabilities
      };
    } catch (e) {}
    const balance = Number(user.wallet?.balance ?? 0);
    const currency = user.wallet?.currency || "USD";
    const totalEarnings = Number(walletCredits._sum.amount ?? 0);

    const tasksDueToday = tasksAssigned.filter((t) => isDueToday(t.dueDate));
    const highPriorityToday = tasksDueToday.filter((t) =>
      ["high", "urgent"].includes(String(t.priority || "").toLowerCase()),
    ).length;

    // Response rate approx: non-pending / all proposals
    const responseRate =
      proposalsAll > 0 ? Math.round(((proposalsAll - proposalsPending) / proposalsAll) * 100) : 0;

    // Monthly earnings series from wallet credits (last 12 months)
    const now = new Date();
    const months: { key: string; month: string; earnings: number; proposals: number }[] = [];
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
      if (bucket) bucket.earnings += Number(tx.amount || 0);
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
      if (bucket) bucket.proposals += 1;
    }
    const earningsSeries = months.map(({ month, earnings, proposals }) => ({
      month,
      earnings: Math.round(earnings),
      proposals,
    }));

    // Skill distribution from comma-separated skills
    let skillsRaw = parseSkills(user.freelancerProfile?.skills);
    if (skillsRaw.length > 0) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const uuidSkills = skillsRaw.filter((s) => uuidRegex.test(s));
      if (uuidSkills.length > 0) {
        const dbSkills = await prisma.skill.findMany({
          where: { id: { in: uuidSkills } },
          select: { id: true, name: true },
        });
        
        let moSkills: any[] = [];
        try {
          moSkills = await (prisma as any).masterOption.findMany({
            where: { id: { in: uuidSkills } },
            select: { id: true, label: true, value: true },
          });
        } catch (e) {}

        let regData: any = {};
        try {
          regData = typeof user.registrationData === "string" ? JSON.parse(user.registrationData) : (user.registrationData || {});
        } catch (e) {}
        const regSkillMap = new Map();
        if (Array.isArray(regData.skillsList)) {
          regData.skillsList.forEach((s: any) => regSkillMap.set(s.id, s.name));
        }

        const SKILL_NAME_MAP: Record<string, string> = {
          "d3a26eae-3ead-45a6-ac19-9dec47a66add": "Node.js",
          "05756b73-b112-4948-96a7-e6d0df6be8d5": "Flutter",
          "sk_1": "React",
          "sk_2": "TypeScript"
        };
        
        const skillMap = new Map(dbSkills.map((s) => [s.id, s.name]));
        const moMap = new Map(moSkills.map((s) => [s.id, s.label || s.value]));
        
        skillsRaw = skillsRaw.map((s) => skillMap.get(s) || moMap.get(s) || regSkillMap.get(s) || SKILL_NAME_MAP[s] || s);
      }
    }
    const skillDist =
      skillsRaw.length > 0
        ? skillsRaw.slice(0, 5).map((name, i, arr) => ({
            name,
            value: Math.max(8, Math.round(100 / arr.length) - i),
          }))
        : [];

    // Collect all client IDs/names that look like UUIDs
    const clientIds = new Set<string>();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const addIfUuid = (val: any) => {
      if (typeof val === 'string' && uuidRegex.test(val)) {
        clientIds.add(val);
      }
    };
    allProposals.forEach(p => {
      if (p.project?.client) addIfUuid(p.project.client);
    });
    recentProposals.forEach(p => {
      if (p.project?.client) addIfUuid(p.project.client);
    });
    openProjectRows.forEach(p => {
      if (p.client) addIfUuid(p.client);
    });
    recentContracts.forEach(c => {
      if (c.project?.client) addIfUuid(c.project.client);
    });

    const clientMap = new Map<string, string>();
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

    const resolveClientName = (clientVal: string | null | undefined) => {
      if (!clientVal) return "Client";
      if (clientMap.has(clientVal)) {
        return clientMap.get(clientVal) || "Client";
      }
      return clientVal;
    };

    const recentProjects = recentContracts.map((c) => {
      const project = c.project;
      const progress =
        String(c.status).toLowerCase() === "completed"
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
          headline:
            user.freelancerProfile?.industry
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
        notifications: notificationRows.map(mapNotifRow),        wallet: {
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
          messages: unreadMessages,
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
  } catch (err) {
    next(err);
  }
};

function parseSkills(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || "").trim()).filter(Boolean);
  }
  return String(raw || "")
    .split(/[,|;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitLocation(location: string | null | undefined) {
  const raw = String(location || "").trim();
  if (!raw) return { city: null as string | null, country: null as string | null };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return { city: parts[0], country: null };
  return { city: parts[0], country: parts.slice(1).join(", ") };
}

export const getFreelancerProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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

    const profile = user.freelancerProfile as any;
    let skills = parseSkills(profile?.skills);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let title = profile?.titleHeadline || profile?.industry || "";
    let industry = profile?.industry || "";

    const allUuids = [...skills];
    if (uuidRegex.test(title)) allUuids.push(title);
    if (uuidRegex.test(industry)) allUuids.push(industry);

    if (allUuids.length > 0) {
      const uniqueUuids = Array.from(new Set(allUuids));
      
      const [dbSkills, dbIndustries, dbCategories] = await Promise.all([
        prisma.skill.findMany({ where: { id: { in: uniqueUuids } }, select: { id: true, name: true } }),
        prisma.industry.findMany({ where: { id: { in: uniqueUuids } }, select: { id: true, name: true } }),
        prisma.skillCategory.findMany({ where: { id: { in: uniqueUuids } }, select: { id: true, name: true } })
      ]);
      
      let moSkills: any[] = [];
      try {
        moSkills = await (prisma as any).masterOption.findMany({
          where: { id: { in: uniqueUuids } },
          select: { id: true, label: true, value: true },
        });
      } catch (e) {}

      let regData: any = {};
      try {
        regData = typeof user.registrationData === "string" ? JSON.parse(user.registrationData) : (user.registrationData || {});
      } catch (e) {}
      
      const regMap = new Map();
      if (Array.isArray(regData.skillsList)) {
        regData.skillsList.forEach((s: any) => regMap.set(s.id, s.name));
      }
      if (regData.industry && typeof regData.industry === 'object') {
        regMap.set(regData.industry.id, regData.industry.name || regData.industry.label);
      }
      if (regData.title && typeof regData.title === 'object') {
        regMap.set(regData.title.id, regData.title.name || regData.title.label);
      }

      const SKILL_NAME_MAP: Record<string, string> = {
        "d3a26eae-3ead-45a6-ac19-9dec47a66add": "Node.js",
        "05756b73-b112-4948-96a7-e6d0df6be8d5": "Flutter",
        "sk_1": "React",
        "sk_2": "TypeScript"
      };
      
      const resolvedMap = new Map();
      dbSkills.forEach(s => resolvedMap.set(s.id, s.name));
      dbIndustries.forEach(s => resolvedMap.set(s.id, s.name));
      dbCategories.forEach(s => resolvedMap.set(s.id, s.name));
      moSkills.forEach(s => resolvedMap.set(s.id, s.label || s.value));
      regMap.forEach((v, k) => resolvedMap.set(k, v));
      Object.entries(SKILL_NAME_MAP).forEach(([k, v]) => resolvedMap.set(k, v));

      skills = skills.map((s) => resolvedMap.get(s) || s);
      title = resolvedMap.get(title) || title;
      industry = resolvedMap.get(industry) || industry;
    }

    const completion: any = profileCompletion(user, profile);
    try {
      const { resolveProfileCompletion } = await import("../../services/mobile/profile-completion.service.js");
      const realCompletion = await resolveProfileCompletion(user.id);
      completion.overall = realCompletion.profileCompletion;
      completion.readinessEngine = {
        profileLevel: realCompletion.profileLevel,
        operationalReady: realCompletion.operationalReady,
        requirements: realCompletion.requirements,
        verification: realCompletion.verification,
        capabilities: realCompletion.capabilities
      };
    } catch (e) {}
    const location = [user.city, user.country].filter(Boolean).join(", ");
    const headline =
      (user.bio && user.bio.trim()) ||
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
        title,
        industry,
        experience: profile?.experience || "",
        skills,
        skillsText: skills.join(", "),
        hourlyRate: profile?.hourlyRate ?? null,
        city: user.city || "",
        country: user.country || "",
        location,
        availability: profile?.availability || (user.status === "active" ? "Available for work" : "Unavailable"),
        currency: profile?.currency || "USD",
        monthlyRate: profile?.monthlyRetainer ?? null,
        workingHours: profile?.workingHours || "",
        responseTime: profile?.responseTime || "",
        remote: profile?.remoteAvailability ?? true,
        travel: profile?.openToTravel ?? false,
        status: user.status,
        verified: Boolean(user.isVerified || user.verified),
        role: user.role,
        completionPct: completion.overall,
        profileCompletion: completion.items,
        rating: Number(profile?.rating ?? 0) || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateFreelancerProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
    let loc: { city: string | null; country: string | null } = {
      city: existing.city,
      country: existing.country,
    };
    if (cityIn || countryIn) {
      loc = {
        city: cityIn || existing.city,
        country: countryIn || existing.country,
      };
    } else if (locationIn) {
      loc = splitLocation(locationIn);
    }

    // Headline maps to bio when bio not explicitly sent; bio wins if both provided.
    let bio = existing.bio;
    if (body.bio != null) bio = String(body.bio);
    else if (body.headline != null) bio = String(body.headline);

    const avatarUrl =
      body.avatarUrl != null ? String(body.avatarUrl).trim() || null : existing.avatarUrl;
    const phone = body.phone != null ? String(body.phone).trim() || null : existing.phone;

    let status = existing.status;
    if (body.status != null) {
      status = String(body.status).trim() || existing.status;
    } else if (body.availability != null) {
      const a = String(body.availability).toLowerCase();
      if (a.includes("unavailable") || a.includes("not available")) status = "inactive";
      else if (a.includes("available")) status = "active";
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

    const industry =
      body.title != null
        ? String(body.title).trim() || null
        : body.industry != null
          ? String(body.industry).trim() || null
          : existing.freelancerProfile?.industry ?? null;

    const experience =
      body.experience != null
        ? String(body.experience).trim() || null
        : existing.freelancerProfile?.experience ?? null;

    let skillsArr =
      body.skills != null || body.skillsText != null
        ? parseSkills(body.skills ?? body.skillsText)
        : parseSkills(existing.freelancerProfile?.skills);

    // Resolve any skill UUIDs to their actual names before saving
    if (skillsArr.length > 0) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const uuidSkills = skillsArr.filter((s) => uuidRegex.test(s));
      if (uuidSkills.length > 0) {
        const dbSkills = await prisma.skill.findMany({
          where: { id: { in: uuidSkills } },
          select: { id: true, name: true },
        });
        
        let moSkills: any[] = [];
        try {
          moSkills = await (prisma as any).masterOption.findMany({
            where: { id: { in: uuidSkills } },
            select: { id: true, label: true, value: true },
          });
        } catch (e) {}
        
        const SKILL_NAME_MAP: Record<string, string> = {
          "d3a26eae-3ead-45a6-ac19-9dec47a66add": "Node.js",
          "05756b73-b112-4948-96a7-e6d0df6be8d5": "Flutter",
          "sk_1": "React",
          "sk_2": "TypeScript"
        };
        
        const skillMap = new Map(dbSkills.map((s) => [s.id, s.name]));
        const moMap = new Map(moSkills.map((s) => [s.id, s.label || s.value]));
        
        skillsArr = skillsArr.map((s) => skillMap.get(s) || moMap.get(s) || SKILL_NAME_MAP[s] || s);
      }
    }

    const hourlyRateRaw = body.hourlyRate;
    let hourlyRate = existing.freelancerProfile?.hourlyRate ?? null;
    if (hourlyRateRaw != null && hourlyRateRaw !== "") {
      const n = Number(String(hourlyRateRaw).replace(/[^0-9.]/g, ""));
      hourlyRate = Number.isFinite(n) ? n : null;
    }

    const currency = body.currency != null ? String(body.currency).trim() : existing.freelancerProfile?.currency ?? null;
    
    const monthlyRateRaw = body.monthlyRate;
    let monthlyRetainer = existing.freelancerProfile?.monthlyRetainer ?? null;
    if (monthlyRateRaw != null && monthlyRateRaw !== "") {
      const n = Number(String(monthlyRateRaw).replace(/[^0-9.]/g, ""));
      monthlyRetainer = Number.isFinite(n) ? n : null;
    }

    const availability = body.availability != null ? String(body.availability).trim() : existing.freelancerProfile?.availability ?? null;
    const workingHours = body.workingHours != null ? String(body.workingHours).trim() : existing.freelancerProfile?.workingHours ?? null;
    const responseTime = body.responseTime != null ? String(body.responseTime).trim() : existing.freelancerProfile?.responseTime ?? null;
    const remoteAvailability = body.remoteAvailability != null ? Boolean(body.remoteAvailability) : existing.freelancerProfile?.remoteAvailability ?? true;
    const openToTravel = body.openToTravel != null ? Boolean(body.openToTravel) : existing.freelancerProfile?.openToTravel ?? false;

    await prisma.freelancerProfile.upsert({
      where: { userId },
      update: {
        industry,
        experience,
        skills: skillsArr.join(", "),
        hourlyRate,
        currency,
        monthlyRetainer,
        availability,
        workingHours,
        responseTime,
        remoteAvailability,
        openToTravel,
      },
      create: {
        userId,
        industry,
        experience,
        skills: skillsArr.join(", "),
        hourlyRate,
        currency,
        monthlyRetainer,
        availability,
        workingHours,
        responseTime,
        remoteAvailability,
        openToTravel,
      },
    });

    // Return fresh profile using same shape as GET
    (req as any).user = { ...req.user, id: userId };
    return getFreelancerProfile(req, res, next);
  } catch (err) {
    next(err);
  }
};

export const listFreelancerNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
  } catch (err) {
    next(err);
  }
};

export const markFreelancerNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
  } catch (err) {
    next(err);
  }
};

export const markAllFreelancerNotificationsRead = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
  } catch (err) {
    next(err);
  }
};

type VerificationItem = {
  key: string;
  label: string;
  value: string;
  status: "verified" | "pending" | "missing";
  documentUrl?: string | null;
  required?: boolean;
};

const VERIFICATION_KEYS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: "email", label: "Email address", required: true },
  { key: "phone", label: "Phone number", required: true },
  { key: "identity", label: "Identity (Government ID)", required: true },
  { key: "passport", label: "Passport", required: false },
  { key: "driving", label: "Driving License", required: false },
  { key: "gst", label: "GST (Optional)", required: false },
  { key: "address", label: "Address proof", required: true },
  { key: "selfie", label: "Selfie verification", required: true },
];

function parseVerificationJson(raw: string | null | undefined): Record<string, Partial<VerificationItem>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function buildVerificationItems(user: any, stored: Record<string, Partial<VerificationItem>>): VerificationItem[] {
  const location = [user.city, user.country].filter(Boolean).join(", ");
  const accountVerified = Boolean(user.isVerified || user.verified);

  return VERIFICATION_KEYS.map(({ key, label, required }) => {
    const fromStore = stored[key] || {};
    let status = (fromStore.status as VerificationItem["status"]) || "missing";
    let value = String(fromStore.value || "").trim();
    const documentUrl = fromStore.documentUrl || null;

    if (key === "email") {
      value = user.email || value || "Not set";
      status = user.email ? "verified" : "missing";
    } else if (key === "phone") {
      value = user.phone || value || "Not submitted";
      status = user.phone ? (fromStore.status as any) || "verified" : "missing";
    } else if (key === "identity") {
      if (!value) value = accountVerified ? "Account verified by admin" : "Not submitted";
      if (accountVerified && status === "missing") status = "verified";
    } else if (key === "address") {
      if (!value && location) {
        value = location;
        status = status === "missing" ? "pending" : status;
      }
      if (!value) value = "Not submitted";
    } else if (!value) {
      value = status === "missing" ? "Not submitted" : value || "Submitted";
    }

    if (!["verified", "pending", "missing"].includes(status)) status = "missing";

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

export const getFreelancerVerification = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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

    const stored = parseVerificationJson((user.freelancerProfile as any)?.verificationJson);
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
  } catch (err) {
    next(err);
  }
};

export const updateFreelancerVerification = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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

    const stored = parseVerificationJson((user.freelancerProfile as any)?.verificationJson);
    const nextStatusRaw = body.status != null ? String(body.status).toLowerCase() : "pending";
    const nextStatus = ["verified", "pending", "missing"].includes(nextStatusRaw)
      ? (nextStatusRaw as VerificationItem["status"])
      : "pending";

    const value =
      body.value != null
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
      if (nextStatus === "missing") stored[key].status = "pending";
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
  } catch (err) {
    next(err);
  }
};

export const getFreelancerPortfolio = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
  } catch (err) {
    next(err);
  }
};

export const getFreelancerPortfolioItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
  } catch (err) {
    next(err);
  }
};

export const createFreelancerPortfolioItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
  } catch (err) {
    next(err);
  }
};

export const updateFreelancerPortfolioItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
    const merged = normalizePortfolioItem(
      {
        ...items[idx],
        ...body,
        id,
        created: items[idx].created,
        title: body.title != null ? String(body.title).trim() : items[idx].title,
      },
      id,
    );
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
  } catch (err) {
    next(err);
  }
};

export const deleteFreelancerPortfolioItem = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
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
  } catch (err) {
    next(err);
  }
};


// --- PHASE 1 REFACTOR: FIND PROJECTS & PROPOSAL STATE MACHINE ---
export const searchPublishedProjects = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false });

    // Strict Auth: Only published projects, not deleted, not belonging to this freelancer
    const { keyword, budgetMin, budgetMax, skills } = req.body || req.query || {};
    
    let where: any = {
      status: "open", 
      deletedAt: null
    };

    if (keyword) {
      where.OR = [
        { title: { contains: String(keyword) } },
        { description: { contains: String(keyword) } }
      ];
    }
    
    // Pagination
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, description: true, budget: true, budgetMin: true, budgetMax: true,
          technology: true, workMode: true, experienceLevel: true, createdAt: true, client: true
        }
      }),
      prisma.project.count({ where })
    ]);

    res.json({ success: true, rows, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const withdrawProposal = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false });
    const { id } = req.params;

    const proposal = await prisma.proposal.findFirst({ where: { id, freelancerId: userId, deletedAt: null } });
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });

    if (["ACCEPTED", "REJECTED", "WITHDRAWN"].includes(proposal.status)) {
      return res.status(400).json({ success: false, message: `Cannot withdraw from state ${proposal.status}` });
    }

    await prisma.proposal.update({ where: { id }, data: { status: "WITHDRAWN" } });
    res.json({ success: true, message: "Proposal withdrawn" });
  } catch (err) {
    next(err);
  }
};

export const acceptOffer = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ success: false });
    const { id } = req.params;

    // Transaction to safely accept and create contract
    const result = await prisma.$transaction(async (tx: any) => {
      const proposal = await tx.proposal.findFirst({ where: { id, freelancerId: userId, deletedAt: null } });
      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "OFFERED") throw new Error("Only OFFERED proposals can be accepted");

      const updated = await tx.proposal.update({
        where: { id },
        data: { status: "ACCEPTED" }
      });

      const proj = await tx.project.findUnique({where: {id: proposal.projectId}});
      
      const existingContract = await tx.contract.findFirst({
        where: { proposalId: proposal.id }
      });

      let contract;
      if (existingContract) {
        contract = await tx.contract.update({
          where: { id: existingContract.id },
          data: { status: "active" }
        });
      } else {
        contract = await tx.contract.create({
          data: {
            contractNumber: `CTR-${Date.now()}`,
            projectId: proposal.projectId,
            clientId: proj?.client || "",
            freelancerId: userId,
            proposalId: proposal.id,
            status: "active",
          }
        });
      }

      return { proposal: updated, contract };
    });

    // Log Activity & Trigger Qualification Engine
    await logActivityEvent({
      type: "CONTRACT_STARTED",
      actorId: userId,
      actorType: "USER",
      contextType: "CONTRACT",
      contextId: result.contract.id,
      metadata: { proposalId: result.proposal.id, projectId: result.contract.projectId },
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};
