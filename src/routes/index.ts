import { Router, Request, Response, NextFunction } from "express";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { prisma } from "../config/database.js";
import { encryptPassword, decryptPassword } from "../utils/crypto.util.js";
import { creditWalletForSelf } from "../common/helpers/portal-shared.js";
import authRoutes from "./auth/auth.routes.js";
import dashboardRoutes from "./dashboard/dashboard.routes.js";
import notificationRoutes, { queueRouter, logsRouter } from "./notifications/notification.routes.js";
import mediaRoutes from "./media/media.routes.js";
import workflowsRoutes from "./workflows/workflows.routes.js";
import financialsRoutes from "./financials/financials.routes.js";
import { downloadInvoice } from "../controllers/financials/financials.controller.js";
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
import referralRoutes from "./referral/referral.routes.js";
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
import publicResumeTemplateRouter from "./public/resume-template.routes.js";
import publicResumeShareRouter from "./public/public-resume-share.routes.js";
import freelancerRoutes from "./freelancer/freelancer.routes.js";
import clientRoutes from "./client/client.routes.js";
import investorRoutes from "./investor/investor.routes.js";
import founderRoutes from "./founder/founder.routes.js";
import paymentsRoutes from "./payments/payments.routes.js";
import messagesRoutes from "./messages/messages.routes.js";
import aboutRouter from "./admin/about.routes.js"; import adminReferralsRouter from "./admin/referrals.routes.js";
import rolesRoutes, { permissionsRouter } from "./admin/roles.routes.js";
import resumeTemplateRouter from "./admin/resume-template.routes.js";
import kycRouter from "./admin/kyc.routes.js";
import adminSupportDeskRouter from "./admin/support-desk.routes.js";
import adminWithdrawalsRouter from "./admin/withdrawals.routes.js";
import { sendAccountDeletedEmail } from "../services/mobile/email.service.js";
import { activateFreeTrialOnKycApproval } from "../services/subscription/free-trial.service.js";
import subscriptionRoutes from "./subscription/subscription.routes.js";
import { getVerificationStats } from "../common/helpers/verification.js";
import tasksRoutes from "./tasks.routes.js";

import mobileRoutes from "../modules/mobile/index.js";
import { saveInvestor, unsaveInvestor } from "../modules/mobile/public/public.controller.js";
import { requireOnboarding } from "../middlewares/onboarding.middleware.js";

const router = Router();

// 1. Auth & Payment routes (Public/Unprotected - mounted on all version prefixes)
router.use("/auth", authRoutes);
router.use("/v1/auth", authRoutes);
router.use("/payments", paymentsRoutes);

// Mobile API Routes (/api/v1/mobile/..., /api/mobile/...)
router.use("/v1/mobile", mobileRoutes);
router.use("/mobile", mobileRoutes);
router.post("/v1/mobile/public/investors/:id/save", authMiddleware as any, saveInvestor as any);
router.delete("/v1/mobile/public/investors/:id/save", authMiddleware as any, unsaveInvestor as any);

// Subscription / Plan Activation Routes
router.use("/subscription", subscriptionRoutes);

import activityRoutes from "./activity/activity.routes.js";
import supportRoutes from "./support/support.routes.js";
import connectionsRoutes from "./connections/connections.routes.js";

// Shared Messages routes (real-time chat API for all roles)
router.use("/messages", messagesRoutes);
router.use("/connections", connectionsRoutes);

// Activity Timeline routes
router.use("/activity", activityRoutes);

// Support & Reports
router.use("/support", supportRoutes);

// Portal (role-scoped)
router.use("/freelancer", freelancerRoutes);
router.use("/client", clientRoutes);
router.use("/investor", investorRoutes);
router.use("/founder", founderRoutes);
router.use("/referrals", referralRoutes);
router.use("/tasks", tasksRoutes);

// Expose OpenAPI specs publicly
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
const listPublicEducationLevelsDirect = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await (prisma as any).masterOption.findMany({
      where: { type: "education_level", status: "active" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true, label: true, value: true },
    }).catch(async () => {
      return prisma.$queryRawUnsafe<any[]>(
        "SELECT id, label, value FROM master_options WHERE type = 'education_level' AND status = 'active' ORDER BY sort_order ASC, label ASC"
      ).catch(() => []);
    });

    return res.json({ success: true, data: rows, rows, total: rows.length });
  } catch (err) {
    return next(err);
  }
};

router.get("/public/education_levels", listPublicEducationLevelsDirect);
router.get("/public/education-levels", listPublicEducationLevelsDirect);
router.get("/v1/public/education_levels", listPublicEducationLevelsDirect);
router.get("/v1/public/education-levels", listPublicEducationLevelsDirect);

router.use("/public", publicRoutes);
router.use("/public/resume-templates", publicResumeTemplateRouter);
router.use("/public/resume-share", publicResumeShareRouter);
router.use("/v1/public", publicRoutes);

// 2.2 Admin operations
router.use("/admin/dashboard", dashboardRoutes);
router.use("/admin/dashboard", dashboardInsightsRouter);
router.use("/admin/notifications", notificationRoutes);
router.use("/admin/notification-queue", queueRouter);
router.use("/admin/notification-logs", logsRouter);
router.use("/admin/media", mediaRoutes);
router.use("/admin/financials", financialsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/admin/roles", rolesRoutes);
router.use("/admin/permissions", permissionsRouter);
router.use("/admin/jobs", jobsRouter);
router.use("/admin/automation-rules", automationRulesRouter);
router.use("/admin/system-ops", systemOpsRouter);
router.use("/admin/analytics", analyticsRouter);
router.use("/admin/analytics", analyticsInsightsRouter);
router.use("/admin/reports", reportsRouter);
router.use("/admin/reports", reportsInsightsRouter);
router.use("/admin/marketing", marketingRouter);
router.use("/admin/system", systemRouter);
router.use("/admin/settings", settingsRouter);
router.use("/admin/developer", developerRouter);
router.use("/admin/kyc", authMiddleware as any, kycRouter); router.use("/admin", adminReferralsRouter);
router.use("/admin/support", adminSupportDeskRouter);
router.use("/admin/withdrawals", adminWithdrawalsRouter);
router.use("/admin", workflowsRoutes);
router.use("/admin/resume-templates", authMiddleware as any, resumeTemplateRouter);




import {
  getAdminContactPage,
  saveContactDraft,
  publishContactPage,
  listContactEnquiries,
  getContactEnquiryById,
  updateContactEnquiry,
} from "../controllers/admin/contact.controller.js";

import {
  getAdminCareersPage,
  saveCareersDraft,
  publishCareersPage,
  listAdminJobs,
  createJob,
  updateJob,
  deleteJob,
  listCareerApplications,
  getCareerApplicationById,
  updateCareerApplication,
} from "../controllers/admin/careers.controller.js";

// Contact CMS & Enquiries Admin Routes
router.get("/admin/contact-page", getAdminContactPage);
router.put("/admin/contact-page/draft", saveContactDraft);
router.post("/admin/contact-page/publish", publishContactPage);

router.get("/admin/contact-enquiries", listContactEnquiries);
router.get("/admin/contact-enquiries/:id", getContactEnquiryById);
router.patch("/admin/contact-enquiries/:id", updateContactEnquiry);

// Careers CMS, Jobs & Applications Admin Routes
router.get("/admin/careers-page", getAdminCareersPage);
router.put("/admin/careers-page/draft", saveCareersDraft);
router.post("/admin/careers-page/publish", publishCareersPage);

router.get("/admin/careers/jobs", listAdminJobs);
router.post("/admin/careers/jobs", createJob);
router.put("/admin/careers/jobs/:id", updateJob);
router.delete("/admin/careers/jobs/:id", deleteJob);

router.get("/admin/careers/applications", listCareerApplications);
router.get("/admin/careers/applications/:id", getCareerApplicationById);
router.patch("/admin/careers/applications/:id", updateCareerApplication);

// Dedicated Admin Legal Policies APIs
router.get("/admin/legal-policies/:policyId", async (req, res, next) => {
  try {
    const policyId = req.params.policyId;
    const dbNameMap: Record<string, string> = { "legal": "Legal", "privacy": "Privacy", "refund-policy": "Refund Policy" };
    const dbName = dbNameMap[policyId];
    if (!dbName) return res.status(400).json({ success: false, message: "Invalid policy ID" });

    const row = await prisma.cmsPage.findFirst({ where: { name: dbName } });
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
});

router.put("/admin/legal-policies/:policyId", async (req, res, next) => {
  try {
    const policyId = req.params.policyId;
    const dbNameMap: Record<string, string> = { "legal": "Legal", "privacy": "Privacy", "refund-policy": "Refund Policy" };
    const dbName = dbNameMap[policyId];
    if (!dbName) return res.status(400).json({ success: false, message: "Invalid policy ID" });

    const existing = await prisma.cmsPage.findFirst({ where: { name: dbName } });
    if (existing) {
      const updated = await prisma.cmsPage.update({
        where: { id: existing.id },
        data: req.body,
      });
      res.json({ success: true, data: updated });
    } else {
      const created = await prisma.cmsPage.create({
        data: { name: dbName, category: "legal", ...req.body },
      });
      res.json({ success: true, data: created });
    }
  } catch (e) {
    next(e);
  }
});

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
  cms_how_it_works: "CmsHowItWorks",
  workflow_steps: "WorkflowStep",
  blogs: "Blog",
  faqs: "Faq",
  testimonials: "Testimonial",
  email_templates: "EmailTemplate",
  support_tickets: "SupportTicket",
  contact_enquiries: "ContactEnquiry",
  job_openings: "JobOpening",
  career_applications: "CareerApplication",
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
  cities: "City",
  currencies: "Currency",
  languages: "Language",
  startup_stages: "StartupStage",
  funding_types: "FundingType",
  work_modes: "WorkMode",
  experience_levels: "ExperienceLevel",
  pricing_plans: "SubscriptionPlan",
  master_options: "MasterOption",
  coupons: "Coupon",
  campaigns: "Campaign",
  insight_reports: "InsightReport",
  analytics_dashboards: "AnalyticsDashboard",
  invoices: "Invoice",
  referrals: "Referral",
  advertisements: "Advertisement",
  wallet_transactions: "WalletTransaction",
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
  help_categories: "HelpCategory",
  help_articles: "HelpArticle",
  help_video_guides: "HelpVideoGuide",
};

// Searchable columns for each model
const searchColumnsMapping: Record<string, string[]> = {
  City: ["name"],
  User: ["fullName", "email", "country"],
  Project: ["title", "client", "freelancer", "category", "technology", "timeline", "status"],
  Task: ["title", "assignedTo"],
  HelpCategory: ["name", "slug", "shortDescription"],
  HelpArticle: ["title", "slug", "excerpt", "content"],
  HelpVideoGuide: ["title", "description"],
  StartupIdea: ["startup", "founder", "industry"],
  Investment: ["investor", "startup"],
  Meeting: ["founder", "investor"],
  Subscription: ["plan", "user"],
  Payment: ["user", "gateway", "invoice"],
  WalletTransaction: ["type", "description", "status"],
  Conversation: ["name", "role"],
  CmsPage: ["name", "category"],
  Blog: ["title", "category", "author"],
  CmsHowItWorks: ["sectionName", "roleType", "title"],
  WorkflowStep: ["roleType", "title"],
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

const freelancerInclude = { authIdentities: true,
  subscriptions: { include: { plan: true }, where: { status: 'active' } },
  
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
      verificationJson: true,
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

const clientInclude = { authIdentities: true,
  subscriptions: { include: { plan: true }, where: { status: 'active' } },
  
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

const investorInclude = { authIdentities: true,
  subscriptions: { include: { plan: true }, where: { status: 'active' } },
  
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

const founderInclude = { authIdentities: true,
  subscriptions: { include: { plan: true }, where: { status: 'active' } },
  
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

export async function enrichUserRowNamesAsync(row: any) {
  if (!row) return row;
  
  const extractUUIDs = (str: any) => {
    if (Array.isArray(str)) return str.filter(s => typeof s === "string" && s.length === 36 && s.includes("-"));
    if (typeof str !== "string") return [];
    // A skill or industry might appear multiple times or have extra spaces
    return [...new Set(str.split(",").map(s => s.trim()).filter(s => s.length === 36 && s.includes("-")))];
  };

  const profile = row.freelancerProfile || row.clientProfile || row.founderProfile || row.investorProfile || {};
  const regData = row.registrationData || {};

  const getCombinedIds = (...fields: any[]) => {
    const ids: string[] = [];
    for (const f of fields) ids.push(...extractUUIDs(f));
    return [...new Set(ids)];
  };

  const skillIds = getCombinedIds(profile.skills, row.skills, regData.skills);
  const industryIds = getCombinedIds(profile.industry, row.industry, regData.industry);
  const countryIds = getCombinedIds(row.country, profile.country, regData.country);

  if (skillIds.length > 0) {
    const skills = await prisma.skill.findMany({ where: { id: { in: skillIds } }, select: { id: true, name: true } });
    const skillMap = Object.fromEntries(skills.map(s => [s.id, s.name]));
    const replacer = (s: string) => skillMap[s.trim()] || s.trim();
    if (profile.skills) profile.skills = [...new Set(profile.skills.split(",").map(replacer))].join(", ");
    if (row.skills) row.skills = [...new Set(row.skills.split(",").map(replacer))].join(", ");
    if (regData.skills) {
      if (Array.isArray(regData.skills)) regData.skills = [...new Set(regData.skills.map(replacer))];
      else if (typeof regData.skills === "string") regData.skills = [...new Set(regData.skills.split(",").map(replacer))].join(", ");
    }
  }

  if (industryIds.length > 0) {
    const ind1 = await prisma.industry.findMany({ where: { id: { in: industryIds } }, select: { id: true, name: true } });
    const ind2 = await prisma.skillCategory.findMany({ where: { id: { in: industryIds } }, select: { id: true, name: true } });
    const industryMap = Object.fromEntries([...ind1, ...ind2].map(i => [i.id, i.name]));
    const replacer = (s: string) => industryMap[s.trim()] || s.trim();
    if (profile.industry) profile.industry = [...new Set(profile.industry.split(",").map(replacer))].join(", ");
    if (row.industry) row.industry = [...new Set(row.industry.split(",").map(replacer))].join(", ");
    if (regData.industry) {
      if (Array.isArray(regData.industry)) regData.industry = [...new Set(regData.industry.map(replacer))];
      else if (typeof regData.industry === "string") regData.industry = [...new Set(regData.industry.split(",").map(replacer))].join(", ");
    }
  }

  if (countryIds.length > 0) {
    const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true, name: true } });
    const countryMap = Object.fromEntries(countries.map(c => [c.id, c.name]));
    const replacer = (s: string) => countryMap[s.trim()] || s.trim();
    if (row.country) row.country = [...new Set(row.country.split(",").map(replacer))].join(", ");
    if (profile.country) profile.country = [...new Set(profile.country.split(",").map(replacer))].join(", ");
    if (regData.country) {
      if (Array.isArray(regData.country)) regData.country = [...new Set(regData.country.map(replacer))];
      else if (typeof regData.country === "string") regData.country = [...new Set(regData.country.split(",").map(replacer))].join(", ");
    }
  }

  return row;
}

export function sanitizeUserRecord<T extends Record<string, any> | null | undefined>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const { password, ...rest } = row as Record<string, any>;

  const freelancerProfile = rest.freelancerProfile ?? {};
  const clientProfile = rest.clientProfile ?? {};
  const investorProfile = rest.investorProfile ?? {};
  const founderProfile = rest.founderProfile ?? {};
  const wallet = rest.wallet ?? {};
  const regData = rest.registrationData ?? {};

  const industry = freelancerProfile.industry
    || clientProfile.industry
    || founderProfile.industry
    || (investorProfile.focusAreas ? String(investorProfile.focusAreas).split(",")[0] : null)
    || regData.industry
    || regData.companyCategory
    || regData.category
    || regData.industryName
    || regData.categoryName
    || rest.industry
    || rest.companyCategory
    || rest.category
    || "Technology";

  const projectsPosted = rest.projects_posted
    ?? rest.projectsPosted
    ?? freelancerProfile.projectsPosted
    ?? clientProfile.projectsPosted
    ?? (Array.isArray(rest.freelancerContracts) ? rest.freelancerContracts.length : undefined)
    ?? (Array.isArray(rest.clientContracts) ? rest.clientContracts.length : undefined)
    ?? 0;

  const totalSpend = freelancerProfile.totalSpend
    ?? clientProfile.totalSpend
    ?? founderProfile.raised
    ?? rest.total_spend
    ?? rest.totalSpend
    ?? rest.raised
    ?? 0;

  const ticketMin = investorProfile.ticketMin ?? rest.ticket_min ?? rest.ticketMin ?? regData.ticketMin ?? 25000;
  const ticketMax = investorProfile.ticketMax ?? rest.ticket_max ?? rest.ticketMax ?? regData.ticketMax ?? 250000;
  const deals = investorProfile.deals ?? rest.deals ?? 0;
  const raised = founderProfile.raised ?? rest.raised ?? regData.raised ?? 0;
  const stage = founderProfile.stage ?? rest.stage ?? regData.stage ?? null;

  const workModeArr = Array.isArray(regData.workMode) ? regData.workMode : (freelancerProfile.workMode ? String(freelancerProfile.workMode).split(",").map(s => s.trim()) : (regData.workModeIds || []));
  const industryArr = Array.isArray(regData.industry) ? regData.industry : (freelancerProfile.industry || clientProfile.industry || founderProfile.industry ? String(freelancerProfile.industry || clientProfile.industry || founderProfile.industry).split(",").map(s => s.trim()) : (regData.industryIds || []));
  const skillsArr = Array.isArray(regData.skills) ? regData.skills : (freelancerProfile.skills ? String(freelancerProfile.skills).split(",").map(s => s.trim()) : (regData.skillsIds || []));
  const hiringGoalArr = Array.isArray(regData.hiringGoal) ? regData.hiringGoal : (clientProfile.hiringGoal ? String(clientProfile.hiringGoal).split(",").map(s => s.trim()) : (regData.hiringGoalIds || []));
  const preferredStageArr = Array.isArray(regData.preferredStage) ? regData.preferredStage : (investorProfile.preferredStage ? String(investorProfile.preferredStage).split(",").map(s => s.trim()) : (regData.preferredStageIds || []));
  const primaryGoalArr = Array.isArray(regData.primaryGoal) ? regData.primaryGoal : (founderProfile.primaryGoal ? String(founderProfile.primaryGoal).split(",").map(s => s.trim()) : (regData.primaryGoalIds || []));
  const focusAreasArr = Array.isArray(regData.focusAreas) ? regData.focusAreas : (investorProfile.focusAreas ? String(investorProfile.focusAreas).split(",").map(s => s.trim()) : (regData.focusAreaIds || []));

  const stateVal = rest.state ?? regData.stateId ?? regData.state ?? null;
  const rawCntry = rest.country ?? regData.countryId ?? regData.country ?? null;
  const countryIdVal = rawCntry ? (rawCntry.length === 2 ? rawCntry.toUpperCase() : (rawCntry.toLowerCase() === "india" ? "IN" : (rawCntry.toLowerCase() === "united states" || rawCntry.toLowerCase() === "usa" ? "US" : rawCntry))) : null;

  const extractId = (val: any) => typeof val === 'object' && val !== null ? String(val.id || val.value || val.name || val) : String(val);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const SKILL_NAME_MAP: Record<string, string> = {
    "d3a26eae-3ead-45a6-ac19-9dec47a66add": "Node.js",
    "05756b73-b112-4948-96a7-e6d0df6be8d5": "Flutter",
    "sk_1": "React",
    "sk_2": "TypeScript"
  };
  const sklNames = skillsArr.map(val => { const id = extractId(val); return SKILL_NAME_MAP[id] || (uuidRegex.test(id) ? "" : id); });

  const INDUSTRY_NAME_MAP: Record<string, string> = {
    "07f378bf-7e20-4828-ad87-36cc225b48ce": "Software Development",
    "cfd78d15-899b-4582-9be9-0c26f7f431fc": "Data & AI",
    "ind_1": "Software Development",
    "ind_2": "Data & AI"
  };
  const indNames = industryArr.map(val => { const id = extractId(val); return INDUSTRY_NAME_MAP[id] || (uuidRegex.test(id) ? "" : id); });

  const WORK_MODE_NAME_MAP: Record<string, string> = {
    "14b8b7de-0038-4ee2-83b9-7c7726a6b92c": "Remote",
    "043d8f44-1e80-405b-a0b5-d70458f87ded": "Hybrid",
    "wm_1": "Remote",
    "wm_3": "Hybrid"
  };
  const wmNames = workModeArr.map(val => { const id = extractId(val); return WORK_MODE_NAME_MAP[id] || (uuidRegex.test(id) ? "" : id); });

  const HIRING_GOAL_NAME_MAP: Record<string, string> = {
    "hg_1": "Hire Full-Time Developers",
    "hg_2": "Hire Freelancers"
  };
  const hgNames = hiringGoalArr.map(val => { const id = extractId(val); return HIRING_GOAL_NAME_MAP[id] || (uuidRegex.test(id) ? "" : id); });

  const PREFERRED_STAGE_MAP: Record<string, string> = {
    "stg_1": "Seed Stage",
    "stg_2": "Pre-Series A",
    "stg_3": "Series A+",
    "stg_4": "MVP / Beta",
    "stg_5": "Idea / Concept"
  };
  const psNames = preferredStageArr.map(val => { const id = extractId(val); return PREFERRED_STAGE_MAP[id] || (uuidRegex.test(id) ? "" : id); });

  const PRIMARY_GOAL_MAP: Record<string, string> = {
    "pg_1": "Looking for Investors",
    "pg_2": "Hiring Top Freelancers",
    "pg_3": "Scaling Startup"
  };
  const pgNames = primaryGoalArr.map(val => { const id = extractId(val); return PRIMARY_GOAL_MAP[id] || (uuidRegex.test(id) ? "" : id); });

  const FOCUS_AREAS_MAP: Record<string, string> = {
    "fa_1": "FinTech & AI",
    "fa_2": "HealthTech",
    "fa_3": "E-Commerce",
    "fa_4": "Web3 & Crypto"
  };
  const faNames = focusAreasArr.map(val => { const id = extractId(val); return FOCUS_AREAS_MAP[id] || (uuidRegex.test(id) ? "" : id); });

  const INVESTOR_TYPE_MAP: Record<string, string> = {
    "angel": "Angel Investor",
    "vc": "Venture Capitalist",
    "syndicate": "Syndicate / PE",
    "family_office": "Family Office"
  };
  // Company size slug/UUID → label
  const COMPANY_SIZE_NAME_MAP: Record<string, string> = {
    "mo_company_size_1_10":   "1-10 employees",
    "mo_company_size_11_50":  "11-50 employees",
    "mo_company_size_51_200": "51-200 employees",
    "mo_company_size_201_500":"201-500 employees",
    "mo_company_size_500_":   "500+ employees",
    "be31b5a4-9bb9-11f1-82ce-00155d010403": "1-10 employees",
    "be31b8e2-9bb9-11f1-82ce-00155d010403": "11-50 employees",
    "be31b9ba-9bb9-11f1-82ce-00155d010403": "51-200 employees",
    "be31ba5b-9bb9-11f1-82ce-00155d010403": "200+ employees",
    "opt_company_size_1":         "Self-employed / Just Me",
    "opt_company_size_2-10":      "2–10 employees",
    "opt_company_size_11-50":     "11–50 employees",
    "opt_company_size_51-200":    "51–200 employees",
    "opt_company_size_201-500":   "201–500 employees",
    "opt_company_size_501-1000":  "501–1,000 employees",
    "opt_company_size_1001-5000": "1,001–5,000 employees",
    "opt_company_size_5001-10000":"5,001–10,000 employees",
    "opt_company_size_10001_":    "10,001+ employees",
  };
  // Budget range UUID → label
  const BUDGET_RANGE_NAME_MAP: Record<string, string> = {
    "3837dfac-c0ed-40e0-95fc-1226a94d43de": "₹10,000 - ₹50,000",
    "9be47422-9aaa-475d-b053-1c704ec05d12": "₹5,000 - ₹10,000",
    "c2efbb4d-49f8-4f7b-b467-bd1a306b9891": "₹1,000 - ₹5,000",
    "91e8ea9c-3efc-48f7-8768-d7985f472f69": "₹5,00,000 - ₹10,00,000",
    "01ea75fc-9478-4a85-96b9-840f4434e9bc": "Less than ₹1,000",
    "05f6f4bc-69af-447c-a43e-ecc6cc133b21": "₹50,000+",
    "0d01fe50-a980-4c6f-b589-27db5659bbc8": "₹1,000 - ₹5,000",
    "511ea77b-68ec-4e93-9e29-ba49fdd1eb86": "₹10,000 - ₹50,000",
    "6aaa3f8c-6b09-4fd4-bff5-7c2658d19886": "₹5,000 - ₹10,000",
    "5d3a03e3-41f5-4609-87c9-46306fd2a004": "₹5,000 - ₹10,000",
    "6b2a3b7a-29d9-4604-a5b6-7ce8cbb2c41e": "₹1,000 - ₹5,000",
    "8685e2e7-2fc5-4604-8f67-64cb50f8b32f": "₹50,000+",
    "c4a1e5f1-8675-4df8-b0a7-758c92838f57": "Less than ₹1,000",
    "c6fbda9c-b662-416f-93c1-6e8662d4dfae": "₹10,000 - ₹50,000",
  };
  // Hiring goal UUID → label
  const HIRING_GOAL_UUID_MAP: Record<string, string> = {
    "be330997-9bb9-11f1-82ce-00155d010403": "Hire a single freelancer",
    "be3312c1-9bb9-11f1-82ce-00155d010403": "Hire a full team",
    "be33138d-9bb9-11f1-82ce-00155d010403": "Ongoing project support",
    "be33141a-9bb9-11f1-82ce-00155d010403": "Not sure yet",
  };
  const rLabel = (raw: string | null | undefined, map: Record<string, string>) => raw ? (map[raw] ?? raw) : raw;
  const invTypeVal = investorProfile.investorType ?? regData.investorType ?? null;
  const verificationStats = getVerificationStats(rest);
  const profileApproved = Boolean(verificationStats.profileApproved);
  const kycApproved = Boolean(verificationStats.kycApproved);

  
  let vJson: any = {};
  try {
    if (freelancerProfile && freelancerProfile.verificationJson) {
      vJson = typeof freelancerProfile.verificationJson === "string" 
        ? JSON.parse(freelancerProfile.verificationJson) 
        : freelancerProfile.verificationJson;
    } else if (rest.verificationData) {
      vJson = typeof rest.verificationData === "string" 
        ? JSON.parse(rest.verificationData) 
        : rest.verificationData;
    }
  } catch (e) {}

  const sanitized = {
    ...rest,
    panDocument: vJson.panDocument ?? regData.panDocument ?? rest.panDocument ?? null,
    aadharDocument: vJson.aadharDocument ?? regData.aadharDocument ?? rest.aadharDocument ?? null,
    gstDocument: vJson.gstDocument ?? regData.gstDocument ?? rest.gstDocument ?? null,
    businessProof: vJson.businessProof ?? regData.businessProof ?? rest.businessProof ?? null,
    addressProof: vJson.addressProof ?? regData.addressProof ?? rest.addressProof ?? null,
    pitchDeck: founderProfile?.pitchDeck ?? regData.pitchDeck ?? rest.pitchDeck ?? null,
    resume: freelancerProfile?.resumeUrl ?? regData.resumeUrl ?? regData.resume ?? rest.resume ?? null,
    companyLogo: clientProfile?.logoUrl ?? founderProfile?.logoUrl ?? regData.companyLogo ?? regData.logo ?? rest.companyLogo ?? null,
    attachments: rest.attachments ?? regData.attachments ?? vJson.attachments ?? null,
    hasPassword: Boolean(password && String(password).length > 0),
    userId: rest.id,
    name: rest.fullName,
    phone: rest.phone || "",
    avatar: rest.avatarUrl || null,
    country: rest.country ?? regData.country ?? null,
    countryId: countryIdVal,
    state: stateVal,
    stateId: stateVal,

    Skills: skillsArr.map((id, index) => ({
      skillId: id,
      skillName: sklNames[index] || ""
    })),

    Industry: industryArr.length ? {
      industryId: industryArr[0],
      industryName: indNames[0] || ""
    } : null,

    WorkMode: workModeArr.length ? {
      workModeId: workModeArr[0],
      workModeName: wmNames[0] || ""
    } : null,

    HiringGoal: hiringGoalArr.length ? {
      hiringGoalId: hiringGoalArr[0],
      hiringGoalName: HIRING_GOAL_UUID_MAP[hiringGoalArr[0]] || hgNames[0] || ""
    } : null,

    PreferredStage: preferredStageArr.map((id, index) => ({
      preferredStageId: id,
      preferredStageName: psNames[index] || ""
    })),

    PrimaryGoal: primaryGoalArr.length ? {
      primaryGoalId: primaryGoalArr[0],
      primaryGoalName: pgNames[0] || ""
    } : null,

    FocusAreas: focusAreasArr.map((id, index) => ({
      focusAreaId: id,
      focusAreaName: faNames[index] || ""
    })),

    InvestorType: invTypeVal ? {
      investorTypeId: invTypeVal,
      investorTypeName: INVESTOR_TYPE_MAP[invTypeVal] || invTypeVal
    } : null,

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
    rating: freelancerProfile.rating ?? 5.0,
    verified: profileApproved,
    profileApproved,
    profileStatus: profileApproved ? "Approved" : "Pending",
    kycApproved,
    kycSubmitted: verificationStats.missingCount === 0,
    missingCount: verificationStats.missingCount,
    kycStatus: kycApproved ? "Approved" : "Pending",
    verificationSummary: {
      profileApproved,
      profileStatus: profileApproved ? "Approved" : "Pending",
      kycApproved,
      kycSubmitted: verificationStats.missingCount === 0,
      missingCount: verificationStats.missingCount,
      kycStatus: kycApproved ? "Approved" : "Pending",
      personalRequired: verificationStats.personalRequired,
      businessRequired: verificationStats.businessRequired,
      personalVerified: verificationStats.personalVerified,
      businessVerified: verificationStats.businessVerified,
      requiredPersonalVerified: verificationStats.requiredPersonalVerified,
      requiredBusinessVerified: verificationStats.requiredBusinessVerified,
    },
    // Freelancer fields
    title: freelancerProfile.titleHeadline ?? regData.titleHeadline ?? rest.titleHeadline ?? "Freelancer",
    titleHeadline: freelancerProfile.titleHeadline ?? regData.titleHeadline ?? rest.titleHeadline ?? "Freelancer",
    professionalTitle: freelancerProfile.titleHeadline ?? regData.titleHeadline ?? rest.titleHeadline ?? "Freelancer",
    bio: freelancerProfile.bio ?? founderProfile.founderBio ?? rest.bio ?? regData.bio ?? regData.founderBio ?? null,
    overview: freelancerProfile.bio ?? founderProfile.founderBio ?? rest.bio ?? regData.bio ?? regData.founderBio ?? null,
    hourly_rate: freelancerProfile.hourlyRate ?? regData.hourlyRate ?? null,
    hourlyRate: freelancerProfile.hourlyRate ?? regData.hourlyRate ?? null,
    experience: freelancerProfile.experience ?? regData.experienceLevel ?? null,
    experienceLevel: freelancerProfile.experience ?? regData.experienceLevel ?? null,
    yearsOfExperience: freelancerProfile.yearsOfExperience ?? regData.yearsOfExperience ?? regData.yearsExperience ?? regData.years ?? null,
    portfolioUrl: freelancerProfile.portfolioUrl ?? regData.portfolioUrl ?? regData.portfolio ?? regData.websiteUrl ?? null,
    linkedInUrl: freelancerProfile.linkedInUrl ?? regData.linkedInUrl ?? regData.linkedin ?? null,
    githubUrl: freelancerProfile.githubUrl ?? regData.githubUrl ?? regData.github ?? null,
    // Client fields — IDs resolved to human-readable labels
    company: clientProfile.company ?? regData.companyName ?? regData.company ?? null,
    companyName: clientProfile.company ?? regData.companyName ?? regData.company ?? null,
    companySize: rLabel(clientProfile.companySize ?? regData.companySize ?? null, COMPANY_SIZE_NAME_MAP),
    companySizeId: regData.companySizeId ?? clientProfile.companySize ?? regData.companySize ?? null,
    companySizeLabel: rLabel(regData.companySizeId ?? clientProfile.companySize ?? regData.companySize ?? null, COMPANY_SIZE_NAME_MAP),
    currentTeam: rLabel(clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null, COMPANY_SIZE_NAME_MAP),
    currentTeamId: regData.currentTeamId ?? clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null,
    currentTeamSize: rLabel(clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null, COMPANY_SIZE_NAME_MAP),
    currentTeamSizeId: regData.currentTeamSizeId ?? regData.currentTeamId ?? clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null,
    projectHireBudget: regData.projectHireBudgetId ?? clientProfile.projectHireBudget ?? regData.projectHireBudget ?? regData.budget ?? null,
    projectHireBudgetId: regData.projectHireBudgetId ?? clientProfile.projectHireBudget ?? regData.projectHireBudget ?? regData.budget ?? null,
    projectHireBudgetLabel: rLabel(regData.projectHireBudgetId ?? clientProfile.projectHireBudget ?? regData.projectHireBudget ?? regData.budget ?? null, BUDGET_RANGE_NAME_MAP),
    websiteUrl: clientProfile.websiteUrl ?? regData.websiteUrl ?? null,
    jobTitle: clientProfile.jobTitle ?? regData.jobTitle ?? null,
    // Investor fields
    firm: investorProfile.firm ?? regData.firm ?? null,
    isAccredited: investorProfile.isAccredited ?? regData.isAccredited ?? null,
    // Founder fields
    startupName: founderProfile.startupName ?? regData.startupName ?? null,
    pitch: founderProfile.pitch ?? regData.pitch ?? null,
    founderRole: founderProfile.founderRole ?? regData.founderRole ?? null,
    founderBio: founderProfile.founderBio ?? regData.founderBio ?? rest.bio ?? regData.bio ?? null,
    teamSize: founderProfile.teamSize ?? regData.teamSize ?? null,
    teamSizeLabel: rLabel(founderProfile.teamSize ?? regData.teamSize ?? null, COMPANY_SIZE_NAME_MAP),
    targetRaise: founderProfile.targetRaise ?? regData.targetRaise ?? null,
    primaryGoal: founderProfile.primaryGoal ?? (primaryGoalArr.length ? primaryGoalArr[0] : null) ?? regData.primaryGoal ?? null,
    hiringGoal: clientProfile.hiringGoal ?? (hiringGoalArr.length ? hiringGoalArr[0] : null) ?? regData.hiringGoal ?? null,

    wallet_balance: wallet.balance ?? rest.wallet_balance ?? rest.walletBalance ?? 0,
    wallet: wallet.balance !== undefined ? wallet : { balance: rest.wallet_balance ?? rest.walletBalance ?? 0 },
  };

  let plainPassword = null;
  if ((sanitized as any).registrationData) {
    try {
      const regObj = typeof (sanitized as any).registrationData === "string" 
        ? JSON.parse((sanitized as any).registrationData) 
        : (sanitized as any).registrationData;
      const rawPlainPassword = regObj.plainPassword || regObj.password || null;
      plainPassword = rawPlainPassword ? decryptPassword(rawPlainPassword) : null;
    } catch(e) {}
  }

  if (!plainPassword && password && typeof password === 'string' && password.includes(':')) {
    try {
      plainPassword = decryptPassword(password);
    } catch(e) {}
  }

  delete (sanitized as any).registrationData;
  delete (sanitized as any).password;

  if ((sanitized as any).freelancerProfile) {
    delete (sanitized as any).freelancerProfile.verificationJson;
    delete (sanitized as any).freelancerProfile.portfolioJson;
    delete (sanitized as any).freelancerProfile.educationJson;
    delete (sanitized as any).freelancerProfile.experienceJson;
  }
  delete (sanitized as any).verificationData;

  (sanitized as any).plainPassword = plainPassword;
  (sanitized as any).currentPasswordHash = password || null;

  return sanitized as unknown as T;
}

export async function sanitizeUserRecordAsync(row: any) {
  const enriched = await enrichUserRowNamesAsync(row);
  return sanitizeUserRecord(enriched);
}

export async function sanitizeUserRowsAsync(rows: Array<Record<string, any>>) {
  const enrichedRows = await Promise.all(rows.map(enrichUserRowNamesAsync));
  return enrichedRows.map(row => sanitizeUserRecord(row));
}

function sanitizeUserRows(rows: Array<Record<string, any>>) {
  return rows.map((row) => sanitizeUserRecord(row));
}

async function getClientProjectCountMap(clientIds: string[]) {
  const uniqueClientIds = [...new Set(clientIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
  if (!uniqueClientIds.length) return new Map<string, number>();

  const counts = await prisma.project.groupBy({
    by: ["client"],
    where: {
      client: { in: uniqueClientIds },
      deletedAt: null,
    },
    _count: { _all: true },
  });

  return new Map(
    counts
      .filter((row) => typeof row.client === "string" && row.client.length > 0)
      .map((row) => [row.client, row._count._all]),
  );
}

function applyClientProjectCounts<T extends Record<string, any>>(rows: T[], projectCounts: Map<string, number>) {
  return rows.map((row) => {
    const count = projectCounts.get(row.id);
    if (typeof count !== "number") return row;

    return {
      ...row,
      projects_posted: count,
      projectsPosted: count,
      clientProfile: row.clientProfile
        ? {
            ...row.clientProfile,
            projectsPosted: count,
          }
        : row.clientProfile,
    };
  });
}

function resolvePasswordHash(password: unknown) {
  const value = typeof password === "string" ? password.trim() : "";
  if (!value) return undefined;
  if (value.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters."), { statusCode: 400 });
  }
  return encryptPassword(value);
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

  const portfolioUrl = profile.portfolioUrl ?? body.portfolioUrl;
  const linkedInUrl = profile.linkedInUrl ?? body.linkedInUrl;
  const resumeUrl = profile.resumeUrl ?? profile.resume ?? body.resumeUrl ?? body.resume;

  if (portfolioUrl !== undefined) profileData.portfolioUrl = portfolioUrl ? String(portfolioUrl) : null;
  if (linkedInUrl !== undefined) profileData.linkedInUrl = linkedInUrl ? String(linkedInUrl) : null;
  if (resumeUrl !== undefined) profileData.resumeUrl = resumeUrl ? String(resumeUrl) : null;

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

adminSkillsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const skill = await prisma.skill.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, industry: { select: { id: true, name: true } } }
        }
      }
    });

    if (!skill) {
      return res.status(404).json({ success: false, message: "Skill not found" });
    }

    const categoryName = skill.category?.name || "General";
    const industryName = skill.industry || skill.category?.industry?.name || categoryName;

    const formatted = {
      ...skill,
      industry: industryName,
      category: skill.category ? {
        ...skill.category,
        industry: skill.category.industry?.name || skill.category.industry || categoryName,
      } : null,
      description: (skill as any).description || `Professional skill mapping for ${skill.name} under ${categoryName} domain.`,
      code: (skill as any).code || (skill.name ? skill.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : "SKL")
    };

    res.json({ success: true, data: formatted, row: formatted });
  } catch (err) {
    next(err);
  }
});

adminSkillsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.skill.delete({ where: { id } });
    res.json({ success: true, ok: true, message: "Skill deleted successfully" });
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

    const where: any = {};
    if (search) where.name = { contains: search };

    const total = await prisma.skillCategory.count({ where });
    const rows = await prisma.skillCategory.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
      include: { _count: { select: { skills: true } } },
    });

    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = req.query.search as string;

    const where: any = {};
    if (search) where.name = { contains: search };

    const total = await prisma.skillCategory.count({ where });
    const rows = await prisma.skillCategory.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { skills: true } } },
    });

    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const cat = await prisma.skillCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { skills: true } },
        skills: { select: { id: true, name: true, status: true, createdAt: true } },
        industry: true,
      }
    });

    if (!cat) {
      return res.status(404).json({ success: false, message: "Skill Category not found" });
    }

    const formatted = {
      ...cat,
      industry: cat.industry?.name || cat.industryId || null,
      description: (cat as any).description || `Skill Category domain for ${cat.name} organizing related professional skills across the platform.`,
      code: (cat as any).code || (cat.name ? cat.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : "CAT")
    };

    res.json({ success: true, data: formatted, row: formatted });
  } catch (err) {
    next(err);
  }
});

adminCategoriesRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, status = "active", sortOrder = 0 } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category Name is required" });
    }

    const created = await prisma.skillCategory.create({
      data: {
        name: name.trim(),
        status: status || "active",
        sortOrder: Number(sortOrder) || 0,
      },
    });

    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(400).json({ success: false, message: `Skill category "${req.body?.name}" already exists.` });
    }
    next(err);
  }
});

adminCategoriesRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, status, sortOrder } = req.body || {};

    const updated = await prisma.skillCategory.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(status && { status }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(400).json({ success: false, message: `Skill category name already exists.` });
    }
    next(err);
  }
});

adminCategoriesRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Find category to get name
    const cat = await prisma.skillCategory.findUnique({ where: { id } });
    const catName = cat?.name;

    // 1. Delete all skills mapped to this category ID or matching category name
    if (catName) {
      await prisma.skill.deleteMany({
        where: {
          OR: [
            { categoryId: id },
            { category: { is: { name: catName } } },
            { industry: catName }
          ]
        }
      }).catch(() => { });
    } else {
      await prisma.skill.deleteMany({ where: { categoryId: id } }).catch(() => { });
    }

    // 2. Delete the category record
    await prisma.skillCategory.delete({ where: { id } });

    res.json({ success: true, ok: true, message: "Skill category and all associated skills deleted successfully." });
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

    res.json({ success: true, rows: await sanitizeUserRowsAsync(rows), total, degraded });
  } catch (err) {
    next(err);
  }
});

adminFreelancersRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await getFreelancerByIdCompat(req.params.id, freelancerInclude);

    if (!row) return res.status(404).json({ success: false, message: "Freelancer not found" });
    res.json({ success: true, data: await sanitizeUserRecordAsync(row) });
  } catch (err) {
    next(err);
  }
});

adminFreelancersRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getFreelancerUserPayload(req.body, true);
    const profileData = getFreelancerProfilePayload(req.body);
    const passwordHash = resolvePasswordHash(req.body.password);

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
          registrationData: JSON.stringify({ plainPassword: req.body.password ? encryptPassword(req.body.password) : null }),
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

      const { password, ...rest } = created;
      row = {
        ...rest,
        freelancerProfile: profile[0] ?? null,
        clientProfile: null,
        wallet: null,
        freelancerContracts: [],
        proposals: [],
        reviewsReceived: [],
      };
    }

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(row.id).catch(console.error);
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
    const passwordHash = resolvePasswordHash(req.body.password);

    if (passwordHash) {
      userData.password = passwordHash;
      
      const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: { registrationData: true } });
      const currentRegData = typeof existing?.registrationData === "string" 
        ? JSON.parse(existing.registrationData || "{}") 
        : ((existing?.registrationData as any) || {});
      
      userData.registrationData = JSON.stringify({ ...currentRegData, plainPassword: req.body.password ? encryptPassword(req.body.password) : null });
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

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
    }

    const row = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: freelancerInclude,
    });

    res.json({ success: true, data: await sanitizeUserRecordAsync(row) });
  } catch (err: any) {
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
});

adminFreelancersRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: "Freelancer not found" });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    if (user.email) {
      sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
    }

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
    const projectCounts = await getClientProjectCountMap(rows.map((r) => r.id));
    const rowsWithProjectCounts = applyClientProjectCounts(rows, projectCounts);

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

    const sanitizedRows = (await sanitizeUserRowsAsync(rowsWithProjectCounts)).map((r: any) => ({
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
    const projectCounts = await getClientProjectCountMap([row.id]);
    const [rowWithProjectCounts] = applyClientProjectCounts([row], projectCounts);

    const docSetting = await prisma.setting.findUnique({
      where: { key: `portal:${row.id}:documents` },
    });

    let documents = [];
    if (docSetting) {
      try {
        documents = JSON.parse(docSetting.value) || [];
      } catch { }
    }

    res.json({ success: true, data: { ...(await sanitizeUserRecordAsync(rowWithProjectCounts)), documents } });
  } catch (err) {
    next(err);
  }
});

adminClientsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getClientUserPayload(req.body, true);
    const profileData = getClientProfilePayload(req.body);
    const passwordHash = resolvePasswordHash(req.body.password);

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

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(row.id).catch(console.error);
    }

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
    const passwordHash = resolvePasswordHash(req.body.password);

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

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
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
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: "Client not found" });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    if (user.email) {
      sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
    }

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
    res.json({ success: true, data: await sanitizeUserRecordAsync(row) });
  } catch (err) {
    next(err);
  }
});

adminInvestorsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getInvestorUserPayload(req.body, true);
    const profileData = getInvestorProfilePayload(req.body);
    const passwordHash = resolvePasswordHash(req.body.password);

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

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(row.id).catch(console.error);
    }

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
    const passwordHash = resolvePasswordHash(req.body.password);

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

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
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
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: "Investor not found" });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    if (user.email) {
      sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
    }

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
    res.json({ success: true, data: await sanitizeUserRecordAsync(row) });
  } catch (err) {
    next(err);
  }
});

adminFoundersRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = getFounderUserPayload(req.body, true);
    const profileData = getFounderProfilePayload(req.body);
    const passwordHash = resolvePasswordHash(req.body.password);

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

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(row.id).catch(console.error);
    }

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
    const passwordHash = resolvePasswordHash(req.body.password);

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

    if (userData.isVerified || userData.verified || userData.status === "active") {
      activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
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
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: "Founder not found" });

    await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    if (user.email) {
      sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
    }

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

router.use("/admin/about-page", authMiddleware as any, aboutRouter);

// 4. Dynamic Whitelisted CRUD Routers
Object.entries(tableModelMapping).forEach(([tableName, modelName]) => {
  if (["freelancers", "clients", "investors", "founders"].includes(tableName)) return;

  console.log("Mounting CRUD router for:", tableName, modelName);

  const searchCols = searchColumnsMapping[modelName] || ["name"];
  const include =
    modelName === "Task"
      ? { attachments: true, project: { select: { id: true, title: true, category: true } } }
      : modelName === "SkillCategory"
        ? { _count: { select: { skills: true } } }
        : modelName === "Skill"
          ? { category: { select: { id: true, name: true } } }
          : modelName === "City"
            ? { country: { select: { id: true, name: true } } }
            : modelName === "WalletTransaction"
              ? { wallet: { include: { user: { select: { id: true, fullName: true, email: true, role: true } } } } }
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
    [`/admin/${tableName}`, `/admin/crud/${tableName}`],
    authMiddleware as any,
    auditMiddleware("mutate", tableName) as any,
    crudRouter
  );
});

// Provide a convenience admin route for downloading invoice PDFs (used by admin UI)
router.get(
  "/admin/invoices/:id/download",
  authMiddleware as any,
  // audit read
  auditMiddleware("read", "invoices") as any,
  async (req, res, next) => {
    try {
      await downloadInvoice(req as any, res as any);
    } catch (err) {
      next(err);
    }
  }
);

// Admin shortcut to resend invoice email with attachment
router.post(
  "/admin/invoices/:id/resend",
  authMiddleware as any,
  // audit mutate
  auditMiddleware("mutate", "invoices") as any,
  async (req, res, next) => {
    try {
      const { resendInvoice } = await import("../controllers/financials/financials.controller.js");
      await resendInvoice(req as any, res as any);
    } catch (err) {
      next(err);
    }
  }
);

router.post("/admin/users/:id/remind-kyc", authMiddleware as any, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const { sendEmail } = await import("../services/mobile/email.service.js");
    await sendEmail(
      user.email!,
      "Action Required: Complete Your KYC on Go Experts",
      `<p>Hi ${user.fullName || "User"},</p><p>We noticed that your KYC verification is incomplete. Please log in to your dashboard and submit the required documents so we can fully activate your account and features.</p><p>Thank you,<br>The Go Experts Team</p>`
    );
    res.json({ success: true, message: "KYC reminder sent" });
  } catch (e) {
    next(e);
  }
});

router.post("/admin/users/:id/remind-profile", authMiddleware as any, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const { sendEmail } = await import("../services/mobile/email.service.js");
    await sendEmail(
      user.email!,
      "Action Required: Complete Your Profile on Go Experts",
      `<p>Hi ${user.fullName || "User"},</p><p>Your profile is currently incomplete. To get the most out of Go Experts and start connecting with others, please take a moment to log in and complete your profile to at least 75%.</p><p>Thank you,<br>The Go Experts Team</p>`
    );
    res.json({ success: true, message: "Profile reminder sent" });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/users/:id/remind-onboarding", authMiddleware as any, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const { EmailChannelAdapter } = await import("../modules/notifications/notification.service.js");
    const emailAdapter = new EmailChannelAdapter();
    let parsedConfig = {};
    const chanConfig = await prisma.communicationChannel.findUnique({ where: { name: "email" } }).catch(() => null);
    if (chanConfig?.config) parsedConfig = JSON.parse(chanConfig.config);

    const clientHost = process.env.CLIENT_URL || "https://goexperts.in";
    const loginLink = `${clientHost}/login`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background-color: #f9fafb; padding: 40px 20px; border-radius: 12px;">
        <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center;">
          <h2 style="color: #1a202c; font-size: 24px; font-weight: 800; margin-bottom: 16px;">Complete Your Onboarding</h2>
          <p style="font-size: 16px; color: #4a5568; line-height: 1.6; margin-bottom: 24px; text-align: left;">
            Hi <strong>${user.fullName || "User"}</strong>,<br><br>
            We noticed that you haven't fully completed your onboarding on <strong>Go Experts</strong>. 
            Completing your profile is essential to unlock the full potential of our platform, whether you're looking to connect with top-tier talent, innovative startups, or verified investors.
          </p>
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 32px; text-align: left;">
            <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px;">Why complete onboarding?</h4>
            <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
              <li>Gain instant access to matched opportunities.</li>
              <li>Enhance your visibility within the Go Experts network.</li>
              <li>Activate your account for communications and proposals.</li>
            </ul>
          </div>
          <a href="${loginLink}" style="background-color: #E30613; color: #ffffff; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 16px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(227, 6, 19, 0.3);">
            Resume Onboarding &rarr;
          </a>
          <p style="margin-top: 32px; font-size: 13px; color: #94a3b8; text-align: center;">
            If you need any assistance, our support team is here to help. Just reply to this email.
          </p>
        </div>
      </div>
    `;

    await emailAdapter.send({
      to: user.email!,
      subject: "Action Required: Complete Your Go Experts Onboarding",
      body: `Hi ${user.fullName || "User"},\n\nWe noticed that you haven't fully completed your onboarding on Go Experts. Please log in and complete your profile to unlock all platform features.\n\nLogin here: ${loginLink}\n\nThank you,\nThe Go Experts Team`,
      html,
    }, parsedConfig);

    res.json({ success: true, message: "Onboarding reminder sent successfully" });
  } catch (err) {
    next(err);
  }
});

router.get("/admin/users/unread-counts", authMiddleware as any, (req, res) => {
  res.json({
    success: true,
    data: { freelancers: 0, clients: 0, investors: 0, founders: 0 }
  });
});

// Helper: path for the viewed users file
const VIEWED_FILE = path.join(__dirname, "../../.admin-viewed-users.json");

function getViewedIds(): Set<string> {
  try {
    const raw = fs.readFileSync(VIEWED_FILE, "utf-8");
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function addViewedId(id: string) {
  try {
    const ids = getViewedIds();
    ids.add(id);
    fs.writeFileSync(VIEWED_FILE, JSON.stringify([...ids]), "utf-8");
  } catch {
    // ignore
  }
}

router.get("/admin/users/unread-list", authMiddleware as any, async (req, res, next) => {
  try {
    const viewedIds = getViewedIds();
    const unreadUsers = await prisma.user.findMany({
      where: {
        status: "pending",
        id: viewedIds.size > 0 ? { notIn: [...viewedIds] } : undefined,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        status: true,
      }
    });
    res.json({
      success: true,
      data: unreadUsers
    });
  } catch (err) {
    next(err);
  }
});

router.post("/admin/users/:id/mark-viewed", authMiddleware as any, (req, res) => {
  addViewedId(req.params.id);
  res.json({ success: true, message: "Marked viewed" });
});

export default router;




