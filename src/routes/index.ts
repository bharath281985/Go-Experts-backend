import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../config/database.js";
import { creditWalletForSelf } from "../common/helpers/portal-shared.js";
import authRoutes from "./auth/auth.routes.js";
import dashboardRoutes from "./dashboard/dashboard.routes.js";
import notificationRoutes, { queueRouter, logsRouter } from "./notifications/notification.routes.js";
import mediaRoutes from "./media/media.routes.js";
import workflowsRoutes from "./workflows/workflows.routes.js";
import financialsRoutes from "./financials/financials.routes.js";
import jobsRouter from "./scheduler/jobs.routes.js";
import automationRulesRouter from "./scheduler/automation.routes.js";
import systemOpsRouter from "./scheduler/system-ops.routes.js";
import analyticsRouter from "./analytics/analytics.routes.js";
import reportsRouter from "./analytics/reports.routes.js";
import systemRouter from "./system/system.routes.js";
import settingsRouter from "./settings/settings.routes.js";
import dashboardInsightsRouter from "./insights/dashboard-insights.routes.js";
import reportsInsightsRouter from "./insights/reports-insights.routes.js";
import analyticsInsightsRouter from "./insights/analytics-insights.routes.js";
import marketingRouter from "./insights/marketing.routes.js";
import developerRouter from "./developer/developer.routes.js";
import { parseCatalogListBody, parseSkillsListBody } from "../common/helpers/catalog-body.js";
import { createCrudRouter } from "../common/helpers/crud-factory.js";
import {
  isMissingColumnError,
  listFreelancersCompat,
  listSkillsCompat,
  parseSkillListFilters,
  getFreelancerByIdCompat,
  upsertFreelancerProfileCompat,
} from "../common/helpers/prisma-compat.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { auditMiddleware } from "../middlewares/audit.middleware.js";
import publicRoutes from "./public/public.routes.js";
import freelancerRoutes from "./freelancer/freelancer.routes.js";
import clientRoutes from "./client/client.routes.js";
import investorRoutes from "./investor/investor.routes.js";
import founderRoutes from "./founder/founder.routes.js";
import paymentsRoutes from "./payments/payments.routes.js";
import rolesRoutes, { permissionsRouter } from "./admin/roles.routes.js";

import mobileRoutes from "../modules/mobile/index.js";

const router = Router();

// 1. Auth & Payment routes (Public/Unprotected - mounted on all version prefixes)
router.use("/auth", authRoutes);
router.use("/v1/auth", authRoutes);
router.use("/payments", paymentsRoutes);

// Mobile API Routes (/api/v1/mobile/..., /api/mobile/...)
router.use("/v1/mobile", mobileRoutes);
router.use("/mobile", mobileRoutes);

// Portal (role-scoped)
router.use("/freelancer", freelancerRoutes);
router.use("/client", clientRoutes);
router.use("/investor", investorRoutes);
router.use("/founder", founderRoutes);

// Expose OpenAPI specs publicly
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

router.get("/docs/openapi.json", (req, res) => {
  const jsonPath = path.join(__dirname, "../modules/developer/openapi.json");
  if (fs.existsSync(jsonPath)) {
    res.sendFile(jsonPath);
  } else {
    res.status(404).json({ success: false, message: "OpenAPI JSON spec not found." });
  }
});

router.get("/docs/postman.json", (req, res) => {
  const jsonPath = path.join(__dirname, "../modules/developer/postman.json");
  if (fs.existsSync(jsonPath)) {
    res.sendFile(jsonPath);
  } else {
    res.status(404).json({ success: false, message: "Postman collection not found." });
  }
});

// 2. Admin operations
// 2.1 Public operations (used by the public frontend)
router.use("/public", publicRoutes);

// 2.2 Admin operations
router.use("/admin/dashboard",       dashboardRoutes);
router.use("/admin/dashboard",       dashboardInsightsRouter);
router.use("/admin/notifications",   notificationRoutes);
router.use("/admin/notification-queue", queueRouter);
router.use("/admin/notification-logs",  logsRouter);
router.use("/admin/media",           mediaRoutes);
router.use("/admin/financials",      financialsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/admin/roles", rolesRoutes);
router.use("/admin/permissions", permissionsRouter);
router.use("/admin/jobs",             jobsRouter);
router.use("/admin/automation-rules", automationRulesRouter);
router.use("/admin/system-ops",       systemOpsRouter);
router.use("/admin/analytics",        analyticsRouter);
router.use("/admin/analytics",        analyticsInsightsRouter);
router.use("/admin/reports",          reportsRouter);
router.use("/admin/reports",          reportsInsightsRouter);
router.use("/admin/marketing",        marketingRouter);
router.use("/admin/system",           systemRouter);
router.use("/admin/settings",         settingsRouter);
router.use("/admin/developer",        developerRouter);
router.use("/admin",                 workflowsRoutes);




// Map frontend table names to Prisma Models
const tableModelMapping: Record<string, string> = {
  profiles: "User",
  freelancers: "User",
  clients: "User",
  founders: "User",
  investors: "User",
  projects: "Project",
  tasks: "Task",
  startup_ideas: "StartupIdea",
  investments: "Investment",
  meetings: "Meeting",
  subscriptions: "Subscription",
  payments: "Payment",
  conversations: "Conversation",
  messages: "Message",
  cms_pages: "CmsPage",
  blogs: "Blog",
  faqs: "Faq",
  testimonials: "Testimonial",
  email_templates: "EmailTemplate",
  support_tickets: "SupportTicket",
  api_keys: "ApiKey",
  backups: "Backup",
  proposals: "Proposal",
  contracts: "Contract",
  reviews: "Review",
  // Masters:
  industries: "Industry",
  categories: "SkillCategory",
  skill_categories: "SkillCategory",
  skills: "Skill",
  countries: "Country",
  currencies: "Currency",
  languages: "Language",
  startup_stages: "StartupStage",
  funding_types: "FundingType",
  work_modes: "WorkMode",
  experience_levels: "ExperienceLevel",
  pricing_plans: "SubscriptionPlan",
  coupons: "Coupon",
  campaigns: "Campaign",
  insight_reports: "InsightReport",
  analytics_dashboards: "AnalyticsDashboard",
  invoices: "Invoice",
  referrals: "Referral",
  advertisements: "Advertisement",
  featured_services: "FeaturedService",
  ad_plans: "AdvertisementPlan",
  notification_templates: "NotificationTemplate",
  notification_preferences: "NotificationPreference",
  notification_queue: "NotificationQueue",
  notifications: "Notification",
  communication_channels: "CommunicationChannel",
  notification_logs: "NotificationLog",
  notification_campaigns: "NotificationCampaign",
  audit_logs: "AuditLog",
  scheduled_jobs: "ScheduledJob",
  job_history: "JobHistory",
  automation_rules: "AutomationRule",
  automation_logs: "AutomationLog",
  cron_executions: "CronExecution",
  // System Monitoring:
  api_request_logs: "ApiRequestLog",
  login_attempts: "LoginAttempt",
  system_alerts: "SystemAlert",
  // Developer Platform:
  webhooks: "Webhook",
  webhook_deliveries: "WebhookDelivery",
  api_versions: "ApiVersion",
  api_usage_logs: "ApiUsageLog",
  api_changelog: "ApiChangelog",
};

// Searchable columns for each model
const searchColumnsMapping: Record<string, string[]> = {
  User: ["fullName", "email", "country"],
  Project: ["title", "client", "freelancer", "category", "technology", "timeline", "status"],
  Task: ["title", "assignedTo"],
  StartupIdea: ["startup", "founder", "industry"],
  Investment: ["investor", "startup"],
  Meeting: ["founder", "investor"],
  Subscription: ["plan", "user"],
  Payment: ["user", "gateway", "invoice"],
  Conversation: ["name", "role"],
  CmsPage: ["name", "category"],
  Blog: ["title", "category", "author"],
  Faq: ["question", "answer", "category"],
  Testimonial: ["name", "role", "company", "content"],
  SupportTicket: ["subject", "user", "category"],
  Campaign: ["name", "channel", "audience", "category"],
  InsightReport: ["name", "category", "format", "createdBy"],
  AnalyticsDashboard: ["name", "category", "queryModel", "creator"],
  Proposal: ["coverLetter"],
  Contract: ["contractNumber"],
  Review: ["comment"],
};

const freelancerInclude = {
  // Avoid selecting optional JSON columns that may not exist on older production DBs.
  freelancerProfile: {
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
  },
  wallet: {
    include: {
      transactions: {
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
    },
  },
  freelancerContracts: {
    include: { project: true },
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
  proposals: {
    include: { project: true },
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
  reviewsReceived: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
};

const clientInclude = {
  clientProfile: true,
  clientContracts: {
    include: { project: true },
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
  payments: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
  invoices: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
  },
};

const investorInclude = {
  investorProfile: true,
  wallet: {
    include: {
      transactions: {
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
    },
  },
};

const founderInclude = {
  founderProfile: true,
  wallet: {
    include: {
      transactions: {
        orderBy: { createdAt: "desc" as const },
        take: 10,
      },
    },
  },
};

function sanitizeUserRecord<T extends Record<string, any> | null | undefined>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const { password, ...rest } = row as Record<string, any>;

  const freelancerProfile = rest.freelancerProfile ?? {};
  const clientProfile = rest.clientProfile ?? {};
  const investorProfile = rest.investorProfile ?? {};
  const founderProfile = rest.founderProfile ?? {};
  const wallet = rest.wallet ?? {};

  const industry = freelancerProfile.industry
    || clientProfile.industry
    || founderProfile.industry
    || (investorProfile.focusAreas ? String(investorProfile.focusAreas).split(",")[0] : null)
    || rest.industry
    || "Technology";

  const projectsPosted = freelancerProfile.projectsPosted
    ?? clientProfile.projectsPosted
    ?? (Array.isArray(rest.freelancerContracts) ? rest.freelancerContracts.length : undefined)
    ?? (Array.isArray(rest.clientContracts) ? rest.clientContracts.length : undefined)
    ?? rest.projects_posted
    ?? rest.projectsPosted
    ?? 0;

  const totalSpend = freelancerProfile.totalSpend
    ?? clientProfile.totalSpend
    ?? founderProfile.raised
    ?? rest.total_spend
    ?? rest.totalSpend
    ?? rest.raised
    ?? 0;

  const ticketMin = investorProfile.ticketMin ?? rest.ticket_min ?? rest.ticketMin ?? 25000;
  const ticketMax = investorProfile.ticketMax ?? rest.ticket_max ?? rest.ticketMax ?? 250000;
  const deals = investorProfile.deals ?? rest.deals ?? 0;
  const raised = founderProfile.raised ?? rest.raised ?? 0;
  const stage = founderProfile.stage ?? rest.stage ?? null;

  return {
    ...rest,
    hasPassword: Boolean(password && String(password).length > 0),
    industry,
    projects_posted: projectsPosted,
    projectsPosted,
    total_spend: totalSpend,
    totalSpend,
    ticket_min: ticketMin,
    ticketMin,
    ticket_max: ticketMax,
    ticketMax,
    deals,
    raised,
    stage,
    wallet_balance: wallet.balance ?? rest.wallet_balance ?? rest.walletBalance ?? 0,
    wallet: wallet.balance !== undefined ? wallet : { balance: rest.wallet_balance ?? rest.walletBalance ?? 0 },
  } as unknown as T;
}

function sanitizeUserRows(rows: Array<Record<string, any>>) {
  return rows.map((row) => sanitizeUserRecord(row));
}

async function resolvePasswordHash(password: unknown) {
  const value = typeof password === "string" ? password.trim() : "";
  if (!value) return undefined;
  if (value.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters."), { statusCode: 400 });
  }
  return bcrypt.hash(value, 10);
}

const getFreelancerProfilePayload = (body: any) => {
  const relationPayload = body.freelancerProfile ?? {};
  const profile = relationPayload.upsert?.update
    ?? relationPayload.update
    ?? relationPayload.create
    ?? relationPayload.upsert?.create
    ?? relationPayload;
  const profileData: Record<string, unknown> = {};

  const industry = profile.industry ?? body.industry ?? body.category;
  const skills = profile.skills ?? body.skills;
  const hourlyRate = profile.hourlyRate ?? profile.hourly_rate ?? body.hourlyRate ?? body.hourly_rate;
  const rating = profile.rating ?? body.rating;
  const experience = profile.experience ?? body.experience;

  if (industry !== undefined) profileData.industry = industry ? String(industry) : null;
  if (skills !== undefined) profileData.skills = Array.isArray(skills) ? skills.join(", ") : (skills == null ? null : String(skills));
  if (hourlyRate !== undefined && hourlyRate !== "" && hourlyRate != null) {
    const parsed = Number(hourlyRate);
    if (Number.isFinite(parsed)) profileData.hourlyRate = parsed;
  }
  if (rating !== undefined && rating !== "" && rating != null) {
    const parsed = Number(rating);
    if (Number.isFinite(parsed)) profileData.rating = parsed;
  }
  if (experience !== undefined) profileData.experience = experience == null || experience === "" ? null : String(experience);

  return profileData;
};

const getFreelancerUserPayload = (body: any, isCreate = false) => {
  const userData: Record<string, unknown> = {};
  const fullName = body.fullName ?? body.full_name ?? body.name;

  if (fullName !== undefined) userData.fullName = String(fullName);
  if (body.email !== undefined) userData.email = String(body.email);
  if (body.phone !== undefined) userData.phone = body.phone ? String(body.phone) : null;
  if (body.country !== undefined) userData.country = body.country ? String(body.country) : null;
  if (body.city !== undefined) userData.city = body.city ? String(body.city) : null;
  if (body.bio !== undefined || body.description !== undefined) userData.bio = body.bio ?? body.description ?? null;
  if (body.status !== undefined) userData.status = String(body.status);
  if (body.verified !== undefined) userData.verified = Boolean(body.verified);
  if (body.isVerified !== undefined || body.is_verified !== undefined) userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
  if (isCreate) userData.role = "freelancer";

  return userData;
};

const getClientProfilePayload = (body: any) => {
  const relationPayload = body.clientProfile ?? {};
  const profile = relationPayload.upsert?.update
    ?? relationPayload.update
    ?? relationPayload.create
    ?? relationPayload.upsert?.create
    ?? relationPayload;
  const profileData: Record<string, unknown> = {};

  const company = profile.company ?? body.company ?? body.name;
  const industry = profile.industry ?? body.industry ?? body.category;
  const totalSpend = profile.totalSpend ?? profile.total_spend ?? body.totalSpend ?? body.total_spend;
  const projectsPosted = profile.projectsPosted ?? profile.projects_posted ?? body.projectsPosted ?? body.projects_posted;

  if (company !== undefined) profileData.company = company ? String(company) : null;
  if (industry !== undefined) profileData.industry = industry ? String(industry) : null;
  if (totalSpend !== undefined && totalSpend !== "") profileData.totalSpend = Number(totalSpend);
  if (projectsPosted !== undefined && projectsPosted !== "") profileData.projectsPosted = Number(projectsPosted);

  return profileData;
};

const getClientUserPayload = (body: any, isCreate = false) => {
  const userData: Record<string, unknown> = {};
  const fullName = body.fullName ?? body.full_name ?? body.owner ?? body.name;

  if (fullName !== undefined) userData.fullName = String(fullName);
  if (body.email !== undefined) userData.email = String(body.email);
  if (body.phone !== undefined) userData.phone = body.phone ? String(body.phone) : null;
  if (body.country !== undefined) userData.country = body.country ? String(body.country) : null;
  if (body.city !== undefined) userData.city = body.city ? String(body.city) : null;
  if (body.bio !== undefined || body.description !== undefined) userData.bio = body.bio ?? body.description ?? null;
  if (body.status !== undefined) userData.status = String(body.status);
  if (body.verified !== undefined) userData.verified = Boolean(body.verified);
  if (body.isVerified !== undefined || body.is_verified !== undefined) userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
  if (isCreate) userData.role = "client";

  return userData;
};

const getInvestorProfilePayload = (body: any) => {
  const relationPayload = body.investorProfile ?? {};
  const profile = relationPayload.upsert?.update
    ?? relationPayload.update
    ?? relationPayload.create
    ?? relationPayload.upsert?.create
    ?? relationPayload;
  const profileData: Record<string, unknown> = {};

  const firm = profile.firm ?? body.firm ?? body.category;
  const focusAreas = profile.focusAreas ?? profile.focus_areas ?? body.focusAreas ?? body.focus_areas ?? body.focusAreasText;
  const ticketMin = profile.ticketMin ?? profile.ticket_min ?? body.ticketMin ?? body.ticket_min;
  const ticketMax = profile.ticketMax ?? profile.ticket_max ?? body.ticketMax ?? body.ticket_max;
  const deals = profile.deals ?? body.deals;

  if (firm !== undefined) profileData.firm = firm ? String(firm) : null;
  if (focusAreas !== undefined) profileData.focusAreas = Array.isArray(focusAreas) ? focusAreas.join(", ") : String(focusAreas);
  if (ticketMin !== undefined && ticketMin !== "") profileData.ticketMin = Number(ticketMin);
  if (ticketMax !== undefined && ticketMax !== "") profileData.ticketMax = Number(ticketMax);
  if (deals !== undefined && deals !== "") profileData.deals = Number(deals);

  return profileData;
};

const getInvestorUserPayload = (body: any, isCreate = false) => {
  const userData: Record<string, unknown> = {};
  const fullName = body.fullName ?? body.full_name ?? body.name;

  if (fullName !== undefined) userData.fullName = String(fullName);
  if (body.email !== undefined) userData.email = String(body.email);
  if (body.phone !== undefined) userData.phone = body.phone ? String(body.phone) : null;
  if (body.country !== undefined) userData.country = body.country ? String(body.country) : null;
  if (body.city !== undefined) userData.city = body.city ? String(body.city) : null;
  if (body.bio !== undefined || body.description !== undefined) userData.bio = body.bio ?? body.description ?? null;
  if (body.status !== undefined) userData.status = String(body.status);
  if (body.verified !== undefined) userData.verified = Boolean(body.verified);
  if (body.isVerified !== undefined || body.is_verified !== undefined) userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
  if (isCreate) userData.role = "investor";

  return userData;
};

const getFounderProfilePayload = (body: any) => {
  const relationPayload = body.founderProfile ?? {};
  const profile = relationPayload.upsert?.update
    ?? relationPayload.update
    ?? relationPayload.create
    ?? relationPayload.upsert?.create
    ?? relationPayload;
  const profileData: Record<string, unknown> = {};

  const startupName = profile.startupName ?? profile.startup_name ?? body.startupName ?? body.startup_name ?? body.name;
  const industry = profile.industry ?? body.industry ?? body.category;
  const stage = profile.stage ?? body.stage;
  const raised = profile.raised ?? body.raised;
  const teamSize = profile.teamSize ?? profile.team_size ?? body.teamSize ?? body.team_size;

  if (startupName !== undefined) profileData.startupName = startupName ? String(startupName) : null;
  if (industry !== undefined) profileData.industry = industry ? String(industry) : null;
  if (stage !== undefined) profileData.stage = stage ? String(stage) : null;
  if (raised !== undefined && raised !== "") profileData.raised = Number(raised);
  if (teamSize !== undefined && teamSize !== "") profileData.teamSize = Number(teamSize);

  return profileData;
};

const getFounderUserPayload = (body: any, isCreate = false) => {
  const userData: Record<string, unknown> = {};
  const fullName = body.fullName ?? body.full_name ?? body.owner ?? body.name;

  if (fullName !== undefined) userData.fullName = String(fullName);
  if (body.email !== undefined) userData.email = String(body.email);
  if (body.phone !== undefined) userData.phone = body.phone ? String(body.phone) : null;
  if (body.country !== undefined) userData.country = body.country ? String(body.country) : null;
  if (body.city !== undefined) userData.city = body.city ? String(body.city) : null;
  if (body.bio !== undefined || body.description !== undefined) userData.bio = body.bio ?? body.description ?? null;
  if (body.status !== undefined) userData.status = String(body.status);
  if (body.verified !== undefined) userData.verified = Boolean(body.verified);
  if (body.isVerified !== undefined || body.is_verified !== undefined) userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
  if (isCreate) userData.role = "founder";

  return userData;
};

const adminSkillsRouter = Router();

adminSkillsRouter.post("/list", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseSkillsListBody(req.body ?? {});
    const skillFilters = {
      categoryId: body.categoryId,
      industryId: body.industryId,
    };

    const { rows, total, degraded } = await listSkillsCompat(
      body.page ?? 1,
      body.pageSize ?? 50,
      body.search,
      skillFilters,
    );
    const { categoryId: resolvedCategoryId, industryName } = await parseSkillListFilters(skillFilters);

    res.json({
      success: true,
      rows,
      total,
      degraded,
      categoryId: resolvedCategoryId ?? null,
      industry: industryName ?? null,
    });
  } catch (err) {
    next(err);
  }
});

adminSkillsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = req.query.search as string;

    let filters: Record<string, string> = {};
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters as string);
      } catch {
        filters = {};
      }
    }

    const categoryId =
      (req.query.categoryId as string) ||
      (req.query.industryId as string) ||
      filters.categoryId ||
      filters.industryId;

    const skillFilters = {
      categoryId,
      industryId: filters.industryId,
      industry: filters.industry,
      category: filters.category,
    };

    const { rows, total, degraded } = await listSkillsCompat(page, pageSize, search, skillFilters);
    const { categoryId: resolvedCategoryId, industryName } = await parseSkillListFilters(skillFilters);

    res.json({
      success: true,
      rows,
      total,
      degraded,
      categoryId: resolvedCategoryId ?? null,
      industry: industryName ?? null,
    });
  } catch (err) {
    next(err);
  }
});

const adminCategoriesRouter = Router();

adminCategoriesRouter.post("/list", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseCatalogListBody(req.body ?? {});
    const page = body.page ?? 1;
    const pageSize = body.pageSize ?? 50;
    const search = body.search;

    const where: { status: string; name?: { contains: string } } = { status: "active" };
    if (search) where.name = { contains: search };

    const total = await prisma.industry.count({ where });
    const rows = await prisma.industry.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
    });

    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

const adminFreelancersRouter = Router();

adminFreelancersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = req.query.search as string;
    const orderBy = (req.query.orderBy as string) || "createdAt";
    const ascending = req.query.ascending === "true";

    let filters: any = {};
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters as string);
      } catch {
        filters = {};
      }
    }
    const where: any = { ...filters, role: { in: ["freelancer", "Freelancer"] }, deletedAt: null };
    if (search) {
      where.OR = ["fullName", "email", "country", "city", "bio"].map((col) => ({
        [col]: { contains: search },
      }));
    }

    const { rows, total, degraded } = await listFreelancersCompat({
      page,
      pageSize,
      search,
      orderBy,
      ascending,
      filters,
      include: freelancerInclude,
    });

    res.json({ success: true, rows: sanitizeUserRows(rows), total, degraded });
  } catch (err) {
    next(err);
  }
});

adminFreelancersRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await getFreelancerByIdCompat(req.params.id, freelancerInclude);

    if (!row) return res.status(404).json({ success: false, message: "Freelancer not found" });
    res.json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err) {
    next(err);
  }
});

adminFreelancersRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getFreelancerUserPayload(req.body, true);
    const profileData = getFreelancerProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (!userData.fullName || !userData.email) {
      return res.status(400).json({ success: false, message: "Full name and email are required" });
    }

    if (!passwordHash) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(userData.email) },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists. Please use a different email address.",
      });
    }

    let row;
    try {
      row = await prisma.user.create({
        data: {
          email: String(userData.email),
          fullName: String(userData.fullName),
          password: passwordHash,
          role: "freelancer",
          status: String(userData.status ?? "active"),
          phone: (userData.phone as string | null | undefined) ?? null,
          country: (userData.country as string | null | undefined) ?? null,
          city: (userData.city as string | null | undefined) ?? null,
          bio: (userData.bio as string | null | undefined) ?? null,
          verified: Boolean(userData.verified),
          isVerified: Boolean(userData.isVerified),
          freelancerProfile: {
            create: profileData,
          },
        },
        include: freelancerInclude,
      });
    } catch (err) {
      if (!isMissingColumnError(err, "industry") || Object.keys(profileData).length === 0) throw err;

      const created = await prisma.user.create({
        data: {
          email: String(userData.email),
          fullName: String(userData.fullName),
          password: passwordHash,
          role: "freelancer",
          status: String(userData.status ?? "active"),
          phone: (userData.phone as string | null | undefined) ?? null,
          country: (userData.country as string | null | undefined) ?? null,
          city: (userData.city as string | null | undefined) ?? null,
          bio: (userData.bio as string | null | undefined) ?? null,
          verified: Boolean(userData.verified),
          isVerified: Boolean(userData.isVerified),
        },
      });

      await upsertFreelancerProfileCompat(created.id, profileData);
      const profile = await prisma.$queryRaw<Array<{
        id: string;
        userId: string;
        skills: string | null;
        hourlyRate: number | null;
        rating: number | null;
        experience: string | null;
      }>>`
        SELECT
          id,
          user_id as userId,
          skills,
          hourly_rate as hourlyRate,
          rating,
          experience_level as experience
        FROM freelancer_profiles
        WHERE user_id = ${created.id}
        LIMIT 1
      `;

      row = {
        ...created,
        freelancerProfile: profile[0] ?? null,
        wallet: null,
        freelancerContracts: [],
        proposals: [],
        reviewsReceived: [],
      };
    }

    res.status(201).json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminFreelancersRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getFreelancerUserPayload(req.body);
    const profileData = getFreelancerProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (passwordHash) {
      userData.password = passwordHash;
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: userData,
    });

    if (Object.keys(profileData).length > 0) {
      await upsertFreelancerProfileCompat(req.params.id, profileData);
    }

    const walletCredit = req.body.wallet_credit ?? req.body.walletCredit ?? req.body.wallet_balance;
    if (walletCredit != null && walletCredit !== "" && Number(walletCredit) > 0) {
      await creditWalletForSelf(req.params.id, Number(walletCredit), "Admin Credit", "Wallet credited by Super Admin");
    }

    const row = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: freelancerInclude,
    });

    res.json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminFreelancersRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true, ok: true });
  } catch (err) {
    next(err);
  }
});

const adminClientsRouter = Router();

adminClientsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = req.query.search as string;
    const orderBy = (req.query.orderBy as string) || "createdAt";
    const ascending = req.query.ascending === "true";

    let filters: any = {};
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters as string);
      } catch {
        filters = {};
      }
    }
    const where: any = { ...filters, role: { in: ["client", "Client", "Client / Business", "client_business", "business"] }, deletedAt: null };
    if (search) {
      where.OR = [
        ...["fullName", "email", "country", "city", "bio"].map((col) => ({
          [col]: { contains: search },
        })),
        { clientProfile: { is: { company: { contains: search } } } },
        { clientProfile: { is: { industry: { contains: search } } } },
      ];
    }

    const total = await prisma.user.count({ where });
    const rows = await prisma.user.findMany({
      where,
      include: clientInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [orderBy]: ascending ? "asc" : "desc" },
    });

    const docSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: rows.map((r) => `portal:${r.id}:documents`),
        },
      },
    });

    const docMap = new Map(
      docSettings.map((s) => {
        const parts = s.key.split(":");
        const userId = parts[1];
        try {
          return [userId, JSON.parse(s.value) || []];
        } catch {
          return [userId, []];
        }
      })
    );

    const sanitizedRows = sanitizeUserRows(rows).map((r: any) => ({
      ...r,
      documents: docMap.get(r.id) || [],
    }));

    res.json({ success: true, rows: sanitizedRows, total });
  } catch (err) {
    next(err);
  }
});

adminClientsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.user.findFirst({
      where: { id: req.params.id, role: { in: ["client", "Client", "Client / Business", "client_business", "business"] }, deletedAt: null },
      include: clientInclude,
    });

    if (!row) return res.status(404).json({ success: false, message: "Client not found" });
    
    const docSetting = await prisma.setting.findUnique({
      where: { key: `portal:${row.id}:documents` },
    });
    
    let documents = [];
    if (docSetting) {
      try {
        documents = JSON.parse(docSetting.value) || [];
      } catch {}
    }

    res.json({ success: true, data: { ...sanitizeUserRecord(row), documents } });
  } catch (err) {
    next(err);
  }
});

adminClientsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getClientUserPayload(req.body, true);
    const profileData = getClientProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (!userData.fullName || !userData.email) {
      return res.status(400).json({ success: false, message: "Full name and email are required" });
    }

    if (!passwordHash) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(userData.email) },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists. Please use a different email address.",
      });
    }

    const row = await prisma.user.create({
      data: {
        email: String(userData.email),
        fullName: String(userData.fullName),
        password: passwordHash,
        role: "client",
        status: String(userData.status ?? "active"),
        phone: (userData.phone as string | null | undefined) ?? null,
        country: (userData.country as string | null | undefined) ?? null,
        city: (userData.city as string | null | undefined) ?? null,
        bio: (userData.bio as string | null | undefined) ?? null,
        verified: Boolean(userData.verified),
        isVerified: Boolean(userData.isVerified),
        clientProfile: {
          create: profileData,
        },
      },
      include: clientInclude,
    });

    res.status(201).json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminClientsRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getClientUserPayload(req.body);
    const profileData = getClientProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (passwordHash) {
      userData.password = passwordHash;
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: userData,
    });

    if (Object.keys(profileData).length > 0) {
      await prisma.clientProfile.upsert({
        where: { userId: req.params.id },
        update: profileData,
        create: {
          userId: req.params.id,
          ...profileData,
        },
      });
    }

    const walletCredit = req.body.wallet_credit ?? req.body.walletCredit ?? req.body.wallet_balance;
    if (walletCredit != null && walletCredit !== "" && Number(walletCredit) > 0) {
      await creditWalletForSelf(req.params.id, Number(walletCredit), "Admin Credit", "Wallet credited by Super Admin");
    }

    const row = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: clientInclude,
    });

    res.json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminClientsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true, ok: true });
  } catch (err) {
    next(err);
  }
});

const adminInvestorsRouter = Router();

adminInvestorsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = req.query.search as string;
    const orderBy = (req.query.orderBy as string) || "createdAt";
    const ascending = req.query.ascending === "true";

    let filters: any = {};
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters as string);
      } catch {
        filters = {};
      }
    }
    const where: any = { ...filters, role: { in: ["investor", "Investor"] }, deletedAt: null };
    if (search) {
      where.OR = [
        ...["fullName", "email", "country", "city", "bio"].map((col) => ({
          [col]: { contains: search },
        })),
        { investorProfile: { is: { firm: { contains: search } } } },
        { investorProfile: { is: { focusAreas: { contains: search } } } },
      ];
    }

    const total = await prisma.user.count({ where });
    const rows = await prisma.user.findMany({
      where,
      include: investorInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [orderBy]: ascending ? "asc" : "desc" },
    });

    res.json({ success: true, rows: sanitizeUserRows(rows), total });
  } catch (err) {
    next(err);
  }
});

adminInvestorsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.user.findFirst({
      where: { id: req.params.id, role: { in: ["investor", "Investor"] }, deletedAt: null },
      include: investorInclude,
    });

    if (!row) return res.status(404).json({ success: false, message: "Investor not found" });
    res.json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err) {
    next(err);
  }
});

adminInvestorsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getInvestorUserPayload(req.body, true);
    const profileData = getInvestorProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (!userData.fullName || !userData.email) {
      return res.status(400).json({ success: false, message: "Full name and email are required" });
    }

    if (!passwordHash) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(userData.email) },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists. Please use a different email address.",
      });
    }

    const row = await prisma.user.create({
      data: {
        email: String(userData.email),
        fullName: String(userData.fullName),
        password: passwordHash,
        role: "investor",
        status: String(userData.status ?? "active"),
        phone: (userData.phone as string | null | undefined) ?? null,
        country: (userData.country as string | null | undefined) ?? null,
        city: (userData.city as string | null | undefined) ?? null,
        bio: (userData.bio as string | null | undefined) ?? null,
        verified: Boolean(userData.verified),
        isVerified: Boolean(userData.isVerified),
        investorProfile: {
          create: profileData,
        },
      },
      include: investorInclude,
    });

    res.status(201).json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminInvestorsRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getInvestorUserPayload(req.body);
    const profileData = getInvestorProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (passwordHash) {
      userData.password = passwordHash;
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: userData,
    });

    if (Object.keys(profileData).length > 0) {
      await prisma.investorProfile.upsert({
        where: { userId: req.params.id },
        update: profileData,
        create: {
          userId: req.params.id,
          ...profileData,
        },
      });
    }

    const walletCredit = req.body.wallet_credit ?? req.body.walletCredit ?? req.body.wallet_balance;
    if (walletCredit != null && walletCredit !== "" && Number(walletCredit) > 0) {
      await creditWalletForSelf(req.params.id, Number(walletCredit), "Admin Credit", "Wallet credited by Super Admin");
    }

    const row = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: investorInclude,
    });

    res.json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminInvestorsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true, ok: true });
  } catch (err) {
    next(err);
  }
});

const adminFoundersRouter = Router();

adminFoundersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = req.query.search as string;
    const orderBy = (req.query.orderBy as string) || "createdAt";
    const ascending = req.query.ascending === "true";

    let filters: any = {};
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters as string);
      } catch {
        filters = {};
      }
    }
    const where: any = { ...filters, role: { in: ["founder", "Founder", "Startup Founder", "startup founder"] }, deletedAt: null };
    if (search) {
      where.OR = [
        ...["fullName", "email", "country", "city", "bio"].map((col) => ({
          [col]: { contains: search },
        })),
        { founderProfile: { is: { startupName: { contains: search } } } },
        { founderProfile: { is: { industry: { contains: search } } } },
        { founderProfile: { is: { stage: { contains: search } } } },
      ];
    }

    const total = await prisma.user.count({ where });
    const rows = await prisma.user.findMany({
      where,
      include: founderInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [orderBy]: ascending ? "asc" : "desc" },
    });

    res.json({ success: true, rows: sanitizeUserRows(rows), total });
  } catch (err) {
    next(err);
  }
});

adminFoundersRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.user.findFirst({
      where: { id: req.params.id, role: { in: ["founder", "Founder", "Startup Founder", "startup founder"] }, deletedAt: null },
      include: founderInclude,
    });

    if (!row) return res.status(404).json({ success: false, message: "Founder not found" });
    res.json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err) {
    next(err);
  }
});

adminFoundersRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getFounderUserPayload(req.body, true);
    const profileData = getFounderProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (!userData.fullName || !userData.email) {
      return res.status(400).json({ success: false, message: "Full name and email are required" });
    }

    if (!passwordHash) {
      return res.status(400).json({ success: false, message: "Password is required" });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(userData.email) },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists. Please use a different email address.",
      });
    }

    const row = await prisma.user.create({
      data: {
        email: String(userData.email),
        fullName: String(userData.fullName),
        password: passwordHash,
        role: "founder",
        status: String(userData.status ?? "active"),
        phone: (userData.phone as string | null | undefined) ?? null,
        country: (userData.country as string | null | undefined) ?? null,
        city: (userData.city as string | null | undefined) ?? null,
        bio: (userData.bio as string | null | undefined) ?? null,
        verified: Boolean(userData.verified),
        isVerified: Boolean(userData.isVerified),
        founderProfile: {
          create: profileData,
        },
      },
      include: founderInclude,
    });

    res.status(201).json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminFoundersRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getFounderUserPayload(req.body);
    const profileData = getFounderProfilePayload(req.body);
    const passwordHash = await resolvePasswordHash(req.body.password);

    if (passwordHash) {
      userData.password = passwordHash;
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: userData,
    });

    if (Object.keys(profileData).length > 0) {
      await prisma.founderProfile.upsert({
        where: { userId: req.params.id },
        update: profileData,
        create: {
          userId: req.params.id,
          ...profileData,
        },
      });
    }

    const walletCredit = req.body.wallet_credit ?? req.body.walletCredit ?? req.body.wallet_balance;
    if (walletCredit != null && walletCredit !== "" && Number(walletCredit) > 0) {
      await creditWalletForSelf(req.params.id, Number(walletCredit), "Admin Credit", "Wallet credited by Super Admin");
    }

    const row = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: founderInclude,
    });

    res.json({ success: true, data: sanitizeUserRecord(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminFoundersRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });
    res.json({ success: true, ok: true });
  } catch (err) {
    next(err);
  }
});

router.use(
  "/admin/freelancers",
  authMiddleware as any,
  auditMiddleware("mutate", "freelancers") as any,
  adminFreelancersRouter
);

router.use(
  "/admin/skills",
  authMiddleware as any,
  auditMiddleware("mutate", "skills") as any,
  adminSkillsRouter
);

router.use(
  "/admin/categories",
  authMiddleware as any,
  auditMiddleware("mutate", "industries") as any,
  adminCategoriesRouter
);

router.use(
  "/admin/clients",
  authMiddleware as any,
  auditMiddleware("mutate", "clients") as any,
  adminClientsRouter
);

router.use(
  "/admin/investors",
  authMiddleware as any,
  auditMiddleware("mutate", "investors") as any,
  adminInvestorsRouter
);

router.use(
  "/admin/founders",
  authMiddleware as any,
  auditMiddleware("mutate", "founders") as any,
  adminFoundersRouter
);

// 4. Dynamic Whitelisted CRUD Routers
Object.entries(tableModelMapping).forEach(([tableName, modelName]) => {
  if (["freelancers", "clients", "investors", "founders"].includes(tableName)) return;

  const searchCols = searchColumnsMapping[modelName] || ["name"];
  const include =
    modelName === "Task"
      ? { attachments: true, project: { select: { id: true, title: true, category: true } } }
      : modelName === "SkillCategory"
      ? { _count: { select: { skills: true } } }
      : modelName === "Skill"
      ? { category: { select: { id: true, name: true } } }
      : undefined;

  // Create router using factory
  const crudRouter = createCrudRouter(modelName as any, searchCols, include ? { include } : {});

  // We wrap list get request to auto inject default role query filters for user roles
  crudRouter.use((req: any, res: Response, next: NextFunction) => {
    if (req.method === "GET") {
      let filters: any = {};
      if (req.query.filters) {
        try {
          filters = JSON.parse(req.query.filters as string);
        } catch {
          filters = {};
        }
      }

      if (tableName === "freelancers") filters.role = "freelancer";
      if (tableName === "clients") filters.role = "client";
      if (tableName === "investors") filters.role = "investor";
      if (tableName === "founders") filters.role = "founder";
      
      req.query.filters = JSON.stringify(filters);
    }
    next();
  });

  router.use(
    `/admin/${tableName}`,
    authMiddleware as any,
    auditMiddleware("mutate", tableName) as any,
    crudRouter
  );
});

export default router;

