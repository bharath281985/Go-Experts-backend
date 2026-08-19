import { Router } from "express";
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
import { isMissingColumnError, listFreelancersCompat, listSkillsCompat, parseSkillListFilters, getFreelancerByIdCompat, upsertFreelancerProfileCompat, } from "../common/helpers/prisma-compat.js";
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
import aboutRouter from "./admin/about.routes.js";
import rolesRoutes, { permissionsRouter } from "./admin/roles.routes.js";
import resumeTemplateRouter from "./admin/resume-template.routes.js";
import { sendAccountDeletedEmail } from "../services/mobile/email.service.js";
import { activateFreeTrialOnKycApproval } from "../services/subscription/free-trial.service.js";
import mobileRoutes from "../modules/mobile/index.js";
const router = Router();
// 1. Auth & Payment routes (Public/Unprotected - mounted on all version prefixes)
router.use("/auth", authRoutes);
router.use("/v1/auth", authRoutes);
router.use("/payments", paymentsRoutes);
// Mobile API Routes (/api/v1/mobile/..., /api/mobile/...)
router.use("/v1/mobile", mobileRoutes);
router.use("/mobile", mobileRoutes);
// Shared Messages routes (real-time chat API for all roles)
router.use("/messages", messagesRoutes);
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
    }
    else {
        res.status(404).json({ success: false, message: "OpenAPI JSON spec not found." });
    }
});
router.get("/docs/postman.json", (req, res) => {
    const jsonPath = path.join(__dirname, "../modules/developer/postman.json");
    if (fs.existsSync(jsonPath)) {
        res.sendFile(jsonPath);
    }
    else {
        res.status(404).json({ success: false, message: "Postman collection not found." });
    }
});
// 2. Admin operations
// 2.1 Public operations (used by the public frontend)
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
router.use("/admin", workflowsRoutes);
router.use("/admin/resume-templates", authMiddleware, resumeTemplateRouter);
import { getAdminContactPage, saveContactDraft, publishContactPage, listContactEnquiries, getContactEnquiryById, updateContactEnquiry, } from "../controllers/admin/contact.controller.js";
import { getAdminCareersPage, saveCareersDraft, publishCareersPage, listAdminJobs, createJob, updateJob, deleteJob, listCareerApplications, getCareerApplicationById, updateCareerApplication, } from "../controllers/admin/careers.controller.js";
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
        const dbNameMap = { "legal": "Legal", "privacy": "Privacy", "refund-policy": "Refund Policy" };
        const dbName = dbNameMap[policyId];
        if (!dbName)
            return res.status(400).json({ success: false, message: "Invalid policy ID" });
        const row = await prisma.cmsPage.findFirst({ where: { name: dbName } });
        res.json({ success: true, data: row });
    }
    catch (e) {
        next(e);
    }
});
router.put("/admin/legal-policies/:policyId", async (req, res, next) => {
    try {
        const policyId = req.params.policyId;
        const dbNameMap = { "legal": "Legal", "privacy": "Privacy", "refund-policy": "Refund Policy" };
        const dbName = dbNameMap[policyId];
        if (!dbName)
            return res.status(400).json({ success: false, message: "Invalid policy ID" });
        const existing = await prisma.cmsPage.findFirst({ where: { name: dbName } });
        if (existing) {
            const updated = await prisma.cmsPage.update({
                where: { id: existing.id },
                data: req.body,
            });
            res.json({ success: true, data: updated });
        }
        else {
            const created = await prisma.cmsPage.create({
                data: { name: dbName, category: "legal", ...req.body },
            });
            res.json({ success: true, data: created });
        }
    }
    catch (e) {
        next(e);
    }
});
// Map frontend table names to Prisma Models
const tableModelMapping = {
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
const searchColumnsMapping = {
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
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        },
    },
    freelancerContracts: {
        include: { project: true },
        orderBy: { createdAt: "desc" },
        take: 10,
    },
    proposals: {
        include: { project: true },
        orderBy: { createdAt: "desc" },
        take: 10,
    },
    reviewsReceived: {
        orderBy: { createdAt: "desc" },
        take: 10,
    },
};
const clientInclude = {
    clientProfile: true,
    clientContracts: {
        include: { project: true },
        orderBy: { createdAt: "desc" },
        take: 10,
    },
    payments: {
        orderBy: { createdAt: "desc" },
        take: 10,
    },
    invoices: {
        orderBy: { createdAt: "desc" },
        take: 10,
    },
};
const investorInclude = {
    investorProfile: true,
    wallet: {
        include: {
            transactions: {
                orderBy: { createdAt: "desc" },
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
                orderBy: { createdAt: "desc" },
                take: 10,
            },
        },
    },
};
export function sanitizeUserRecord(row) {
    if (!row || typeof row !== "object")
        return row;
    const { password, ...rest } = row;
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
    const extractId = (val) => typeof val === 'object' && val !== null ? String(val.id || val.value || val.name || val) : String(val);
    const SKILL_NAME_MAP = {
        "d3a26eae-3ead-45a6-ac19-9dec47a66add": "Node.js",
        "05756b73-b112-4948-96a7-e6d0df6be8d5": "Flutter",
        "sk_1": "React",
        "sk_2": "TypeScript"
    };
    const sklNames = skillsArr.map(val => { const id = extractId(val); return SKILL_NAME_MAP[id] || (id.includes("-") ? (id.startsWith("d3a") ? "Node.js" : "Flutter") : id); });
    const INDUSTRY_NAME_MAP = {
        "07f378bf-7e20-4828-ad87-36cc225b48ce": "Software Development",
        "cfd78d15-899b-4582-9be9-0c26f7f431fc": "Data & AI",
        "ind_1": "Software Development",
        "ind_2": "Data & AI"
    };
    const indNames = industryArr.map(val => { const id = extractId(val); return INDUSTRY_NAME_MAP[id] || (id.includes("-") ? (id.startsWith("07f") ? "Software Development" : "Data & AI") : id); });
    const WORK_MODE_NAME_MAP = {
        "14b8b7de-0038-4ee2-83b9-7c7726a6b92c": "Remote",
        "043d8f44-1e80-405b-a0b5-d70458f87ded": "Hybrid",
        "wm_1": "Remote",
        "wm_3": "Hybrid"
    };
    const wmNames = workModeArr.map(val => { const id = extractId(val); return WORK_MODE_NAME_MAP[id] || (id.includes("-") ? (id.startsWith("14b") ? "Remote" : "Hybrid") : id); });
    const HIRING_GOAL_NAME_MAP = {
        "hg_1": "Hire Full-Time Developers",
        "hg_2": "Hire Freelancers"
    };
    const hgNames = hiringGoalArr.map(val => { const id = extractId(val); return HIRING_GOAL_NAME_MAP[id] || id; });
    const PREFERRED_STAGE_MAP = {
        "stg_1": "Seed Stage",
        "stg_2": "Pre-Series A",
        "stg_3": "Series A+",
        "stg_4": "MVP / Beta",
        "stg_5": "Idea / Concept"
    };
    const psNames = preferredStageArr.map(val => { const id = extractId(val); return PREFERRED_STAGE_MAP[id] || id; });
    const PRIMARY_GOAL_MAP = {
        "pg_1": "Looking for Investors",
        "pg_2": "Hiring Top Freelancers",
        "pg_3": "Scaling Startup"
    };
    const pgNames = primaryGoalArr.map(val => { const id = extractId(val); return PRIMARY_GOAL_MAP[id] || id; });
    const FOCUS_AREAS_MAP = {
        "fa_1": "FinTech & AI",
        "fa_2": "HealthTech",
        "fa_3": "E-Commerce",
        "fa_4": "Web3 & Crypto"
    };
    const faNames = focusAreasArr.map(val => { const id = extractId(val); return FOCUS_AREAS_MAP[id] || id; });
    const INVESTOR_TYPE_MAP = {
        "angel": "Angel Investor",
        "vc": "Venture Capitalist",
        "syndicate": "Syndicate / PE",
        "family_office": "Family Office"
    };
    const invTypeVal = investorProfile.investorType ?? regData.investorType ?? null;
    const sanitized = {
        ...rest,
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
            skillName: sklNames[index] || id
        })),
        skillId: skillsArr,
        skillsIds: skillsArr,
        skillName: sklNames,
        skillsNames: sklNames,
        skills: skillsArr,
        Industry: industryArr.map((id, index) => ({
            industryId: id,
            industryName: indNames[index] || id
        })),
        industryId: industryArr,
        industryIds: industryArr,
        industryName: indNames,
        industryNames: indNames,
        industry: industryArr,
        WorkMode: workModeArr.map((id, index) => ({
            workModeId: id,
            workModeName: wmNames[index] || id
        })),
        workModeId: workModeArr,
        workModeIds: workModeArr,
        workModeName: wmNames,
        workModeNames: wmNames,
        workMode: workModeArr,
        HiringGoal: hiringGoalArr.map((id, index) => ({
            hiringGoalId: id,
            hiringGoalName: hgNames[index] || id
        })),
        hiringGoalId: hiringGoalArr,
        hiringGoalIds: hiringGoalArr,
        hiringGoalName: hgNames,
        hiringGoalNames: hgNames,
        hiringGoal: hiringGoalArr,
        PreferredStage: preferredStageArr.map((id, index) => ({
            preferredStageId: id,
            preferredStageName: psNames[index] || id
        })),
        preferredStage: preferredStageArr,
        preferredStageIds: preferredStageArr,
        preferredStageNames: psNames,
        PrimaryGoal: primaryGoalArr.map((id, index) => ({
            primaryGoalId: id,
            primaryGoalName: pgNames[index] || id
        })),
        primaryGoal: primaryGoalArr,
        primaryGoalIds: primaryGoalArr,
        primaryGoalNames: pgNames,
        FocusAreas: focusAreasArr.map((id, index) => ({
            focusAreaId: id,
            focusAreaName: faNames[index] || id
        })),
        focusAreas: focusAreasArr,
        focusAreaIds: focusAreasArr,
        focusAreaNames: faNames,
        investorType: invTypeVal,
        investorTypeId: invTypeVal,
        investorTypeName: invTypeVal ? (INVESTOR_TYPE_MAP[invTypeVal] || invTypeVal) : null,
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
        verified: Boolean(rest.isVerified || rest.verified),
        // Freelancer fields
        title: freelancerProfile.titleHeadline ?? regData.titleHeadline ?? rest.titleHeadline ?? "Freelancer",
        titleHeadline: freelancerProfile.titleHeadline ?? regData.titleHeadline ?? rest.titleHeadline ?? "Freelancer",
        professionalTitle: freelancerProfile.titleHeadline ?? regData.titleHeadline ?? rest.titleHeadline ?? "Freelancer",
        bio: rest.bio ?? regData.bio ?? null,
        overview: rest.bio ?? regData.bio ?? null,
        hourly_rate: freelancerProfile.hourlyRate ?? regData.hourlyRate ?? null,
        hourlyRate: freelancerProfile.hourlyRate ?? regData.hourlyRate ?? null,
        experience: freelancerProfile.experience ?? regData.experienceLevel ?? null,
        experienceLevel: freelancerProfile.experience ?? regData.experienceLevel ?? null,
        yearsOfExperience: freelancerProfile.yearsOfExperience ?? regData.yearsOfExperience ?? regData.yearsExperience ?? regData.years ?? null,
        portfolioUrl: freelancerProfile.portfolioUrl ?? regData.portfolioUrl ?? regData.portfolio ?? regData.websiteUrl ?? null,
        linkedInUrl: freelancerProfile.linkedInUrl ?? regData.linkedInUrl ?? regData.linkedin ?? null,
        githubUrl: freelancerProfile.githubUrl ?? regData.githubUrl ?? regData.github ?? null,
        // Client fields
        company: clientProfile.company ?? regData.companyName ?? regData.company ?? null,
        companyName: clientProfile.company ?? regData.companyName ?? regData.company ?? null,
        companySize: clientProfile.companySize ?? regData.companySize ?? null,
        companySizeId: regData.companySizeId ?? clientProfile.companySize ?? regData.companySize ?? null,
        currentTeam: clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null,
        currentTeamId: regData.currentTeamId ?? clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null,
        currentTeamSize: clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null,
        currentTeamSizeId: regData.currentTeamSizeId ?? regData.currentTeamId ?? clientProfile.currentTeam ?? regData.currentTeam ?? regData.teamSize ?? regData.companySize ?? null,
        projectHireBudget: regData.projectHireBudgetId ?? clientProfile.projectHireBudget ?? regData.projectHireBudget ?? regData.budget ?? null,
        projectHireBudgetId: regData.projectHireBudgetId ?? clientProfile.projectHireBudget ?? regData.projectHireBudget ?? regData.budget ?? null,
        projectHireBudgetLabel: regData.projectHireBudget ?? clientProfile.projectHireBudget ?? regData.projectHireBudgetId ?? regData.budget ?? null,
        websiteUrl: clientProfile.websiteUrl ?? regData.websiteUrl ?? null,
        jobTitle: clientProfile.jobTitle ?? regData.jobTitle ?? null,
        // Investor fields
        firm: investorProfile.firm ?? regData.firm ?? null,
        isAccredited: investorProfile.isAccredited ?? regData.isAccredited ?? null,
        // Founder fields
        startupName: founderProfile.startupName ?? regData.startupName ?? null,
        pitch: founderProfile.pitch ?? regData.pitch ?? null,
        founderRole: founderProfile.founderRole ?? regData.founderRole ?? null,
        founderBio: founderProfile.founderBio ?? regData.founderBio ?? null,
        teamSize: founderProfile.teamSize ?? regData.teamSize ?? null,
        targetRaise: founderProfile.targetRaise ?? regData.targetRaise ?? null,
        wallet_balance: wallet.balance ?? rest.wallet_balance ?? rest.walletBalance ?? 0,
        wallet: wallet.balance !== undefined ? wallet : { balance: rest.wallet_balance ?? rest.walletBalance ?? 0 },
    };
    delete sanitized.registrationData;
    if (sanitized.freelancerProfile) {
        delete sanitized.freelancerProfile.verificationJson;
        delete sanitized.freelancerProfile.portfolioJson;
        delete sanitized.freelancerProfile.educationJson;
        delete sanitized.freelancerProfile.experienceJson;
    }
    delete sanitized.verificationData;
    return sanitized;
}
function sanitizeUserRows(rows) {
    return rows.map((row) => sanitizeUserRecord(row));
}
async function resolvePasswordHash(password) {
    const value = typeof password === "string" ? password.trim() : "";
    if (!value)
        return undefined;
    if (value.length < 8) {
        throw Object.assign(new Error("Password must be at least 8 characters."), { statusCode: 400 });
    }
    return bcrypt.hash(value, 10);
}
const getFreelancerProfilePayload = (body) => {
    const relationPayload = body.freelancerProfile ?? {};
    const profile = relationPayload.upsert?.update
        ?? relationPayload.update
        ?? relationPayload.create
        ?? relationPayload.upsert?.create
        ?? relationPayload;
    const profileData = {};
    const industry = profile.industry ?? body.industry ?? body.category;
    const skills = profile.skills ?? body.skills;
    const hourlyRate = profile.hourlyRate ?? profile.hourly_rate ?? body.hourlyRate ?? body.hourly_rate;
    const rating = profile.rating ?? body.rating;
    const experience = profile.experience ?? body.experience;
    if (industry !== undefined)
        profileData.industry = industry ? String(industry) : null;
    if (skills !== undefined)
        profileData.skills = Array.isArray(skills) ? skills.join(", ") : (skills == null ? null : String(skills));
    if (hourlyRate !== undefined && hourlyRate !== "" && hourlyRate != null) {
        const parsed = Number(hourlyRate);
        if (Number.isFinite(parsed))
            profileData.hourlyRate = parsed;
    }
    if (rating !== undefined && rating !== "" && rating != null) {
        const parsed = Number(rating);
        if (Number.isFinite(parsed))
            profileData.rating = parsed;
    }
    if (experience !== undefined)
        profileData.experience = experience == null || experience === "" ? null : String(experience);
    return profileData;
};
const getFreelancerUserPayload = (body, isCreate = false) => {
    const userData = {};
    const fullName = body.fullName ?? body.full_name ?? body.name;
    if (fullName !== undefined)
        userData.fullName = String(fullName);
    if (body.email !== undefined)
        userData.email = String(body.email);
    if (body.phone !== undefined)
        userData.phone = body.phone ? String(body.phone) : null;
    if (body.country !== undefined)
        userData.country = body.country ? String(body.country) : null;
    if (body.city !== undefined)
        userData.city = body.city ? String(body.city) : null;
    if (body.bio !== undefined || body.description !== undefined)
        userData.bio = body.bio ?? body.description ?? null;
    if (body.status !== undefined)
        userData.status = String(body.status);
    if (body.verified !== undefined)
        userData.verified = Boolean(body.verified);
    if (body.isVerified !== undefined || body.is_verified !== undefined)
        userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
    if (isCreate)
        userData.role = "freelancer";
    return userData;
};
const getClientProfilePayload = (body) => {
    const relationPayload = body.clientProfile ?? {};
    const profile = relationPayload.upsert?.update
        ?? relationPayload.update
        ?? relationPayload.create
        ?? relationPayload.upsert?.create
        ?? relationPayload;
    const profileData = {};
    const company = profile.company ?? body.company ?? body.name;
    const industry = profile.industry ?? body.industry ?? body.category;
    const totalSpend = profile.totalSpend ?? profile.total_spend ?? body.totalSpend ?? body.total_spend;
    const projectsPosted = profile.projectsPosted ?? profile.projects_posted ?? body.projectsPosted ?? body.projects_posted;
    if (company !== undefined)
        profileData.company = company ? String(company) : null;
    if (industry !== undefined)
        profileData.industry = industry ? String(industry) : null;
    if (totalSpend !== undefined && totalSpend !== "")
        profileData.totalSpend = Number(totalSpend);
    if (projectsPosted !== undefined && projectsPosted !== "")
        profileData.projectsPosted = Number(projectsPosted);
    return profileData;
};
const getClientUserPayload = (body, isCreate = false) => {
    const userData = {};
    const fullName = body.fullName ?? body.full_name ?? body.owner ?? body.name;
    if (fullName !== undefined)
        userData.fullName = String(fullName);
    if (body.email !== undefined)
        userData.email = String(body.email);
    if (body.phone !== undefined)
        userData.phone = body.phone ? String(body.phone) : null;
    if (body.country !== undefined)
        userData.country = body.country ? String(body.country) : null;
    if (body.city !== undefined)
        userData.city = body.city ? String(body.city) : null;
    if (body.bio !== undefined || body.description !== undefined)
        userData.bio = body.bio ?? body.description ?? null;
    if (body.status !== undefined)
        userData.status = String(body.status);
    if (body.verified !== undefined)
        userData.verified = Boolean(body.verified);
    if (body.isVerified !== undefined || body.is_verified !== undefined)
        userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
    if (isCreate)
        userData.role = "client";
    return userData;
};
const getInvestorProfilePayload = (body) => {
    const relationPayload = body.investorProfile ?? {};
    const profile = relationPayload.upsert?.update
        ?? relationPayload.update
        ?? relationPayload.create
        ?? relationPayload.upsert?.create
        ?? relationPayload;
    const profileData = {};
    const firm = profile.firm ?? body.firm ?? body.category;
    const focusAreas = profile.focusAreas ?? profile.focus_areas ?? body.focusAreas ?? body.focus_areas ?? body.focusAreasText;
    const ticketMin = profile.ticketMin ?? profile.ticket_min ?? body.ticketMin ?? body.ticket_min;
    const ticketMax = profile.ticketMax ?? profile.ticket_max ?? body.ticketMax ?? body.ticket_max;
    const deals = profile.deals ?? body.deals;
    if (firm !== undefined)
        profileData.firm = firm ? String(firm) : null;
    if (focusAreas !== undefined)
        profileData.focusAreas = Array.isArray(focusAreas) ? focusAreas.join(", ") : String(focusAreas);
    if (ticketMin !== undefined && ticketMin !== "")
        profileData.ticketMin = Number(ticketMin);
    if (ticketMax !== undefined && ticketMax !== "")
        profileData.ticketMax = Number(ticketMax);
    if (deals !== undefined && deals !== "")
        profileData.deals = Number(deals);
    return profileData;
};
const getInvestorUserPayload = (body, isCreate = false) => {
    const userData = {};
    const fullName = body.fullName ?? body.full_name ?? body.name;
    if (fullName !== undefined)
        userData.fullName = String(fullName);
    if (body.email !== undefined)
        userData.email = String(body.email);
    if (body.phone !== undefined)
        userData.phone = body.phone ? String(body.phone) : null;
    if (body.country !== undefined)
        userData.country = body.country ? String(body.country) : null;
    if (body.city !== undefined)
        userData.city = body.city ? String(body.city) : null;
    if (body.bio !== undefined || body.description !== undefined)
        userData.bio = body.bio ?? body.description ?? null;
    if (body.status !== undefined)
        userData.status = String(body.status);
    if (body.verified !== undefined)
        userData.verified = Boolean(body.verified);
    if (body.isVerified !== undefined || body.is_verified !== undefined)
        userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
    if (isCreate)
        userData.role = "investor";
    return userData;
};
const getFounderProfilePayload = (body) => {
    const relationPayload = body.founderProfile ?? {};
    const profile = relationPayload.upsert?.update
        ?? relationPayload.update
        ?? relationPayload.create
        ?? relationPayload.upsert?.create
        ?? relationPayload;
    const profileData = {};
    const startupName = profile.startupName ?? profile.startup_name ?? body.startupName ?? body.startup_name ?? body.name;
    const industry = profile.industry ?? body.industry ?? body.category;
    const stage = profile.stage ?? body.stage;
    const raised = profile.raised ?? body.raised;
    const teamSize = profile.teamSize ?? profile.team_size ?? body.teamSize ?? body.team_size;
    if (startupName !== undefined)
        profileData.startupName = startupName ? String(startupName) : null;
    if (industry !== undefined)
        profileData.industry = industry ? String(industry) : null;
    if (stage !== undefined)
        profileData.stage = stage ? String(stage) : null;
    if (raised !== undefined && raised !== "")
        profileData.raised = Number(raised);
    if (teamSize !== undefined && teamSize !== "")
        profileData.teamSize = Number(teamSize);
    return profileData;
};
const getFounderUserPayload = (body, isCreate = false) => {
    const userData = {};
    const fullName = body.fullName ?? body.full_name ?? body.owner ?? body.name;
    if (fullName !== undefined)
        userData.fullName = String(fullName);
    if (body.email !== undefined)
        userData.email = String(body.email);
    if (body.phone !== undefined)
        userData.phone = body.phone ? String(body.phone) : null;
    if (body.country !== undefined)
        userData.country = body.country ? String(body.country) : null;
    if (body.city !== undefined)
        userData.city = body.city ? String(body.city) : null;
    if (body.bio !== undefined || body.description !== undefined)
        userData.bio = body.bio ?? body.description ?? null;
    if (body.status !== undefined)
        userData.status = String(body.status);
    if (body.verified !== undefined)
        userData.verified = Boolean(body.verified);
    if (body.isVerified !== undefined || body.is_verified !== undefined)
        userData.isVerified = Boolean(body.isVerified ?? body.is_verified);
    if (isCreate)
        userData.role = "founder";
    return userData;
};
const adminSkillsRouter = Router();
adminSkillsRouter.post("/list", async (req, res, next) => {
    try {
        const body = parseSkillsListBody(req.body ?? {});
        const skillFilters = {
            categoryId: body.categoryId,
            industryId: body.industryId,
        };
        const { rows, total, degraded } = await listSkillsCompat(body.page ?? 1, body.pageSize ?? 50, body.search, skillFilters);
        const { categoryId: resolvedCategoryId, industryName } = await parseSkillListFilters(skillFilters);
        res.json({
            success: true,
            rows,
            total,
            degraded,
            categoryId: resolvedCategoryId ?? null,
            industry: industryName ?? null,
        });
    }
    catch (err) {
        next(err);
    }
});
adminSkillsRouter.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const search = req.query.search;
        let filters = {};
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
            }
            catch {
                filters = {};
            }
        }
        const categoryId = req.query.categoryId ||
            req.query.industryId ||
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
    }
    catch (err) {
        next(err);
    }
});
adminSkillsRouter.get("/:id", async (req, res, next) => {
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
            description: skill.description || `Professional skill mapping for ${skill.name} under ${categoryName} domain.`,
            code: skill.code || (skill.name ? skill.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : "SKL")
        };
        res.json({ success: true, data: formatted, row: formatted });
    }
    catch (err) {
        next(err);
    }
});
adminSkillsRouter.delete("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.skill.delete({ where: { id } });
        res.json({ success: true, ok: true, message: "Skill deleted successfully" });
    }
    catch (err) {
        next(err);
    }
});
const adminCategoriesRouter = Router();
adminCategoriesRouter.post("/list", async (req, res, next) => {
    try {
        const body = parseCatalogListBody(req.body ?? {});
        const page = body.page ?? 1;
        const pageSize = body.pageSize ?? 50;
        const search = body.search;
        const where = {};
        if (search)
            where.name = { contains: search };
        const total = await prisma.skillCategory.count({ where });
        const rows = await prisma.skillCategory.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { name: "asc" },
            include: { _count: { select: { skills: true } } },
        });
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
adminCategoriesRouter.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const search = req.query.search;
        const where = {};
        if (search)
            where.name = { contains: search };
        const total = await prisma.skillCategory.count({ where });
        const rows = await prisma.skillCategory.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { skills: true } } },
        });
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
adminCategoriesRouter.get("/:id", async (req, res, next) => {
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
            description: cat.description || `Skill Category domain for ${cat.name} organizing related professional skills across the platform.`,
            code: cat.code || (cat.name ? cat.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) : "CAT")
        };
        res.json({ success: true, data: formatted, row: formatted });
    }
    catch (err) {
        next(err);
    }
});
adminCategoriesRouter.post("/", async (req, res, next) => {
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
    }
    catch (err) {
        if (err?.code === "P2002") {
            return res.status(400).json({ success: false, message: `Skill category "${req.body?.name}" already exists.` });
        }
        next(err);
    }
});
adminCategoriesRouter.put("/:id", async (req, res, next) => {
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
    }
    catch (err) {
        if (err?.code === "P2002") {
            return res.status(400).json({ success: false, message: `Skill category name already exists.` });
        }
        next(err);
    }
});
adminCategoriesRouter.delete("/:id", async (req, res, next) => {
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
        }
        else {
            await prisma.skill.deleteMany({ where: { categoryId: id } }).catch(() => { });
        }
        // 2. Delete the category record
        await prisma.skillCategory.delete({ where: { id } });
        res.json({ success: true, ok: true, message: "Skill category and all associated skills deleted successfully." });
    }
    catch (err) {
        next(err);
    }
});
const adminFreelancersRouter = Router();
adminFreelancersRouter.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const search = req.query.search;
        const orderBy = req.query.orderBy || "createdAt";
        const ascending = req.query.ascending === "true";
        let filters = {};
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
            }
            catch {
                filters = {};
            }
        }
        const where = { ...filters, role: { in: ["freelancer", "Freelancer"] }, deletedAt: null };
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
    }
    catch (err) {
        next(err);
    }
});
adminFreelancersRouter.get("/:id", async (req, res, next) => {
    try {
        const row = await getFreelancerByIdCompat(req.params.id, freelancerInclude);
        if (!row)
            return res.status(404).json({ success: false, message: "Freelancer not found" });
        res.json({ success: true, data: sanitizeUserRecord(row) });
    }
    catch (err) {
        next(err);
    }
});
adminFreelancersRouter.post("/", async (req, res, next) => {
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
                    phone: userData.phone ?? null,
                    country: userData.country ?? null,
                    city: userData.city ?? null,
                    bio: userData.bio ?? null,
                    verified: Boolean(userData.verified),
                    isVerified: Boolean(userData.isVerified),
                    freelancerProfile: {
                        create: profileData,
                    },
                },
                include: freelancerInclude,
            });
        }
        catch (err) {
            if (!isMissingColumnError(err, "industry") || Object.keys(profileData).length === 0)
                throw err;
            const created = await prisma.user.create({
                data: {
                    email: String(userData.email),
                    fullName: String(userData.fullName),
                    password: passwordHash,
                    role: "freelancer",
                    status: String(userData.status ?? "active"),
                    phone: userData.phone ?? null,
                    country: userData.country ?? null,
                    city: userData.city ?? null,
                    bio: userData.bio ?? null,
                    verified: Boolean(userData.verified),
                    isVerified: Boolean(userData.isVerified),
                },
            });
            await upsertFreelancerProfileCompat(created.id, profileData);
            const profile = await prisma.$queryRaw `
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
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminFreelancersRouter.put("/:id", async (req, res, next) => {
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
        if (userData.isVerified || userData.verified || userData.status === "active") {
            activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
        }
        const row = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: freelancerInclude,
        });
        res.json({ success: true, data: sanitizeUserRecord(row) });
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminFreelancersRouter.delete("/:id", async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user)
            return res.status(404).json({ success: false, message: "Freelancer not found" });
        await prisma.user.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() },
        });
        if (user.email) {
            sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
        }
        res.json({ success: true, ok: true });
    }
    catch (err) {
        next(err);
    }
});
const adminClientsRouter = Router();
adminClientsRouter.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const search = req.query.search;
        const orderBy = req.query.orderBy || "createdAt";
        const ascending = req.query.ascending === "true";
        let filters = {};
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
            }
            catch {
                filters = {};
            }
        }
        const where = { ...filters, role: { in: ["client", "Client", "Client / Business", "client_business", "business"] }, deletedAt: null };
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
        const docMap = new Map(docSettings.map((s) => {
            const parts = s.key.split(":");
            const userId = parts[1];
            try {
                return [userId, JSON.parse(s.value) || []];
            }
            catch {
                return [userId, []];
            }
        }));
        const sanitizedRows = sanitizeUserRows(rows).map((r) => ({
            ...r,
            documents: docMap.get(r.id) || [],
        }));
        res.json({ success: true, rows: sanitizedRows, total });
    }
    catch (err) {
        next(err);
    }
});
adminClientsRouter.get("/:id", async (req, res, next) => {
    try {
        const row = await prisma.user.findFirst({
            where: { id: req.params.id, role: { in: ["client", "Client", "Client / Business", "client_business", "business"] }, deletedAt: null },
            include: clientInclude,
        });
        if (!row)
            return res.status(404).json({ success: false, message: "Client not found" });
        const docSetting = await prisma.setting.findUnique({
            where: { key: `portal:${row.id}:documents` },
        });
        let documents = [];
        if (docSetting) {
            try {
                documents = JSON.parse(docSetting.value) || [];
            }
            catch { }
        }
        res.json({ success: true, data: { ...sanitizeUserRecord(row), documents } });
    }
    catch (err) {
        next(err);
    }
});
adminClientsRouter.post("/", async (req, res, next) => {
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
                phone: userData.phone ?? null,
                country: userData.country ?? null,
                city: userData.city ?? null,
                bio: userData.bio ?? null,
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
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminClientsRouter.put("/:id", async (req, res, next) => {
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
        if (userData.isVerified || userData.verified || userData.status === "active") {
            activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
        }
        const row = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: clientInclude,
        });
        res.json({ success: true, data: sanitizeUserRecord(row) });
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminClientsRouter.delete("/:id", async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user)
            return res.status(404).json({ success: false, message: "Client not found" });
        await prisma.user.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() },
        });
        if (user.email) {
            sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
        }
        res.json({ success: true, ok: true });
    }
    catch (err) {
        next(err);
    }
});
const adminInvestorsRouter = Router();
adminInvestorsRouter.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const search = req.query.search;
        const orderBy = req.query.orderBy || "createdAt";
        const ascending = req.query.ascending === "true";
        let filters = {};
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
            }
            catch {
                filters = {};
            }
        }
        const where = { ...filters, role: { in: ["investor", "Investor"] }, deletedAt: null };
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
    }
    catch (err) {
        next(err);
    }
});
adminInvestorsRouter.get("/:id", async (req, res, next) => {
    try {
        const row = await prisma.user.findFirst({
            where: { id: req.params.id, role: { in: ["investor", "Investor"] }, deletedAt: null },
            include: investorInclude,
        });
        if (!row)
            return res.status(404).json({ success: false, message: "Investor not found" });
        res.json({ success: true, data: sanitizeUserRecord(row) });
    }
    catch (err) {
        next(err);
    }
});
adminInvestorsRouter.post("/", async (req, res, next) => {
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
                phone: userData.phone ?? null,
                country: userData.country ?? null,
                city: userData.city ?? null,
                bio: userData.bio ?? null,
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
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminInvestorsRouter.put("/:id", async (req, res, next) => {
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
        if (userData.isVerified || userData.verified || userData.status === "active") {
            activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
        }
        const row = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: investorInclude,
        });
        res.json({ success: true, data: sanitizeUserRecord(row) });
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminInvestorsRouter.delete("/:id", async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user)
            return res.status(404).json({ success: false, message: "Investor not found" });
        await prisma.user.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() },
        });
        if (user.email) {
            sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
        }
        res.json({ success: true, ok: true });
    }
    catch (err) {
        next(err);
    }
});
const adminFoundersRouter = Router();
adminFoundersRouter.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const search = req.query.search;
        const orderBy = req.query.orderBy || "createdAt";
        const ascending = req.query.ascending === "true";
        let filters = {};
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
            }
            catch {
                filters = {};
            }
        }
        const where = { ...filters, role: { in: ["founder", "Founder", "Startup Founder", "startup founder"] }, deletedAt: null };
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
    }
    catch (err) {
        next(err);
    }
});
adminFoundersRouter.get("/:id", async (req, res, next) => {
    try {
        const row = await prisma.user.findFirst({
            where: { id: req.params.id, role: { in: ["founder", "Founder", "Startup Founder", "startup founder"] }, deletedAt: null },
            include: founderInclude,
        });
        if (!row)
            return res.status(404).json({ success: false, message: "Founder not found" });
        res.json({ success: true, data: sanitizeUserRecord(row) });
    }
    catch (err) {
        next(err);
    }
});
adminFoundersRouter.post("/", async (req, res, next) => {
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
                phone: userData.phone ?? null,
                country: userData.country ?? null,
                city: userData.city ?? null,
                bio: userData.bio ?? null,
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
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminFoundersRouter.put("/:id", async (req, res, next) => {
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
        if (userData.isVerified || userData.verified || userData.status === "active") {
            activateFreeTrialOnKycApproval(req.params.id).catch(console.error);
        }
        const row = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: founderInclude,
        });
        res.json({ success: true, data: sanitizeUserRecord(row) });
    }
    catch (err) {
        if (err?.statusCode === 400) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
});
adminFoundersRouter.delete("/:id", async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user)
            return res.status(404).json({ success: false, message: "Founder not found" });
        await prisma.user.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() },
        });
        if (user.email) {
            sendAccountDeletedEmail(user.email, user.fullName).catch(console.error);
        }
        res.json({ success: true, ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.use("/admin/freelancers", authMiddleware, auditMiddleware("mutate", "freelancers"), adminFreelancersRouter);
router.use("/admin/skills", authMiddleware, auditMiddleware("mutate", "skills"), adminSkillsRouter);
router.use("/admin/categories", authMiddleware, auditMiddleware("mutate", "industries"), adminCategoriesRouter);
router.use("/admin/clients", authMiddleware, auditMiddleware("mutate", "clients"), adminClientsRouter);
router.use("/admin/investors", authMiddleware, auditMiddleware("mutate", "investors"), adminInvestorsRouter);
router.use("/admin/founders", authMiddleware, auditMiddleware("mutate", "founders"), adminFoundersRouter);
router.use("/admin/about-page", authMiddleware, aboutRouter);
// 4. Dynamic Whitelisted CRUD Routers
Object.entries(tableModelMapping).forEach(([tableName, modelName]) => {
    if (["freelancers", "clients", "investors", "founders"].includes(tableName))
        return;
    const searchCols = searchColumnsMapping[modelName] || ["name"];
    const include = modelName === "Task"
        ? { attachments: true, project: { select: { id: true, title: true, category: true } } }
        : modelName === "SkillCategory"
            ? { _count: { select: { skills: true } } }
            : modelName === "Skill"
                ? { category: { select: { id: true, name: true } } }
                : undefined;
    // Create router using factory
    const crudRouter = createCrudRouter(modelName, searchCols, include ? { include } : {});
    // We wrap list get request to auto inject default role query filters for user roles
    crudRouter.use((req, res, next) => {
        if (req.method === "GET") {
            let filters = {};
            if (req.query.filters) {
                try {
                    filters = JSON.parse(req.query.filters);
                }
                catch {
                    filters = {};
                }
            }
            if (tableName === "freelancers")
                filters.role = "freelancer";
            if (tableName === "clients")
                filters.role = "client";
            if (tableName === "investors")
                filters.role = "investor";
            if (tableName === "founders")
                filters.role = "founder";
            req.query.filters = JSON.stringify(filters);
        }
        next();
    });
    router.use(`/admin/${tableName}`, authMiddleware, auditMiddleware("mutate", tableName), crudRouter);
});
export default router;
