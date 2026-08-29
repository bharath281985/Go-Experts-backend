import { chromium, Browser, Page } from "playwright";
import { prisma } from "../../config/database.js";
import crypto from "crypto";

const EXPORT_TIMEOUT_MS = 30000; // 30s
const CONCURRENCY_LIMIT = 3;
let activeExports = 0;

interface ExportContext {
  userId: string;
  config: any;
  profile: any;
  templateInfo: any;
  token: string;
}

// In-memory store for short-lived export tokens
const exportTokens = new Map<string, ExportContext>();

export class ResumeExportService {
  private static browser: Browser | null = null;

  static async getBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  static async loadExportContext(userId: string): Promise<ExportContext> {
    // 1. Get user profile
    const profile = await prisma.freelancerProfile.findUnique({ where: { userId } });

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const mergedProfile = { ...user, ...(profile || {}) };

    // 2. Get resume config
    const setting = await prisma.setting.findUnique({ where: { key: `resume:${userId}` } });
    let config = { templateId: "", templateVersion: 1 };
    if (setting?.value) {
      try {
        config = JSON.parse(setting.value);
      } catch { }
    }

    // Support legacy "template" vs "templateId"
    const selectedTpl = (config as any).templateId || (config as any).template;

    // 3. Get exact template from database based on user's selection
    let templateInfo = null;
    if (selectedTpl) {
      const liveTemplate = await prisma.resumeTemplate.findFirst({
        where: {
          OR: [
            { id: selectedTpl },
            { key: selectedTpl }
          ]
        },
        include: {
          versions: {
            orderBy: {
              version: "desc"
            },
            take: 1
          }
        }
      });
      if (liveTemplate) {
        const currentVersion = liveTemplate.versions[0];
        templateInfo = {
          id: liveTemplate.id,
          key: liveTemplate.key,
          name: liveTemplate.name,
          rendererKey: currentVersion?.rendererKey || 'professional',
          atsFriendly: currentVersion?.atsFriendly || true,
          supportedSections: currentVersion?.supportedSections || ['experience', 'education', 'skills', 'projects', 'languages']
        };
      }
    }

    if (!templateInfo) {
      templateInfo = {
        id: 'pro-1', key: 'professional', name: 'Professional', rendererKey: 'professional', atsFriendly: true,
        supportedSections: ['experience', 'education', 'skills', 'projects', 'languages', 'certifications', 'awards', 'references']
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const ctx: ExportContext = { userId, config, profile: mergedProfile, templateInfo, token };

    // Store token for 1 minute max
    exportTokens.set(token, ctx);
    setTimeout(() => exportTokens.delete(token), 60000);

    return ctx;
  }

  static getContextByToken(token: string) {
    return exportTokens.get(token);
  }

  static buildResumeDocumentData(ctx: ExportContext & { _snapshotOverride?: any }) {
    if (ctx._snapshotOverride) {
      return ctx._snapshotOverride;
    }

    // Exactly matches the frontend buildResumeDocumentData implementation.
    // This is the single source of truth for the export.
    const { profile, config, templateInfo } = ctx;

    const defaults = {
      headlineMode: 'PROFILE',
      summaryMode: 'PROFILE',
      enabledSections: {},
      sectionOrder: [
        'experience', 'education', 'skills', 'projects',
        'certifications', 'languages', 'awards', 'references'
      ],
      themeConfig: {
        preset: 'classic',
        accentColor: '#0F172A',
        typography: 'inter',
        density: 'comfortable'
      }
    };

    const safeConfig = { ...defaults, ...(config || {}) };
    const safeProfile = profile || {};

    let headline = safeProfile.titleHeadline || safeProfile.headline || '';
    if (safeConfig.headlineMode === 'CUSTOM' && safeConfig.headlineOverride) {
      headline = safeConfig.headlineOverride;
    }

    let summary = safeProfile.bio || '';
    if (safeConfig.summaryMode === 'CUSTOM' && safeConfig.summaryOverride) {
      summary = safeConfig.summaryOverride;
    }

    const visibleSections: Record<string, boolean> = {};
    const supported = templateInfo?.supportedSections || [];

    const ALL_SECTIONS = [
      'experience', 'education', 'skills', 'projects',
      'certifications', 'languages', 'awards', 'references'
    ];

    for (const sec of ALL_SECTIONS) {
      const userPref = safeConfig.enabledSections[sec] !== false;
      const isSupported = supported.includes(sec);
      visibleSections[sec] = userPref && isSupported;
    }

    // Attempt to parse array fields if they are strings (JSON)
    const safeParse = (val: any) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return []; }
      }
      return [];
    };

    return {
      identity: {
        firstName: safeProfile.firstName || safeProfile.fullName?.split(' ')[0] || '',
        lastName: safeProfile.lastName || safeProfile.fullName?.split(' ').slice(1).join(' ') || '',
        avatarUrl: safeProfile.avatarUrl || safeProfile.avatar || '',
      },
      contact: {
        email: safeProfile.email || '',
        phone: safeProfile.phone || '',
        location: safeProfile.location || safeProfile.city || '',
      },
      headline,
      summary,
      experience: safeParse(safeProfile.experience),
      projects: safeParse(safeProfile.portfolioJson), // Map portfolio items to projects if applicable
      skills: safeParse(safeProfile.skills),
      education: safeParse(safeProfile.education),
      certifications: safeParse(safeProfile.certifications),
      languages: safeParse(safeProfile.languages),
      awards: safeParse(safeProfile.awards),
      references: safeParse(safeProfile.references),
      portfolioLinks: safeParse(safeProfile.portfolioLinks),
      socialLinks: safeParse(safeProfile.socialLinks),

      sectionOrder: safeConfig.sectionOrder,
      visibleSections,

      template: {
        id: templateInfo?.id || config?.templateId || '',
        version: templateInfo?.version || config?.templateVersion || 1,
        rendererKey: templateInfo?.rendererKey || 'professional',
      },

      theme: safeConfig.themeConfig
    };
  }

  static async generatePdf(userId: string): Promise<Buffer> {
    if (activeExports >= CONCURRENCY_LIMIT) {
      throw new Error("SERVER_BUSY");
    }

    activeExports++;
    let context: any = null;
    let page: Page | null = null;

    try {
      const exportCtx = await this.loadExportContext(userId);
      const browser = await this.getBrowser();
      context = await browser.newContext();
      page = await context.newPage();

      // Ensure frontend host is available via env or default to localhost:5173
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const renderUrl = `${frontendUrl}/internal/resume/render/${exportCtx.token}`;

      await page.goto(renderUrl, { waitUntil: "networkidle", timeout: EXPORT_TIMEOUT_MS });

      // Wait for deterministic readiness signal
      await page.waitForFunction("window.__RESUME_READY__ === true", {
        timeout: 10000
      });

      // Export A4 PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true, // Use @page { size: A4; margin: 0; }
        margin: { top: 0, right: 0, bottom: 0, left: 0 } // handled in CSS
      });

      return pdfBuffer;
    } finally {
      activeExports--;
      if (page) await page.close().catch(() => { });
      if (context) await context.close().catch(() => { });
    }
  }
}
