import { prisma } from "../../config/database.js";

export interface AboutPageContent {
  version: number;
  hero: {
    eyebrow: string;
    heading: string;
    highlightText: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaUrl: string;
    secondaryCtaLabel: string;
    secondaryCtaUrl: string;
    image: string;
    imageAlt: string;
    enabled: boolean;
  };
  introduction: {
    badge: string;
    heading: string;
    summary: string;
    description: string;
    image: string;
    imageAlt: string;
    videoUrl: string;
    layout: "image_left" | "image_right";
    enabled: boolean;
  };
  missionVision: {
    mission: {
      icon: string;
      title: string;
      description: string;
      ctaLabel?: string;
      ctaUrl?: string;
    };
    vision: {
      icon: string;
      title: string;
      description: string;
      ctaLabel?: string;
      ctaUrl?: string;
    };
    enabled: boolean;
  };
  story: {
    badge: string;
    heading: string;
    content: string;
    image: string;
    imageAlt: string;
    enabled: boolean;
  };
  coreValues: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    order: number;
    enabled: boolean;
  }>;
  statistics: Array<{
    id: string;
    value: string;
    suffix: string;
    label: string;
    icon: string;
    order: number;
    enabled: boolean;
  }>;
  whyChooseUs: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    linkUrl?: string;
    order: number;
    enabled: boolean;
  }>;
  teamMembers: Array<{
    id: string;
    photo: string;
    name: string;
    designation: string;
    department: string;
    bio: string;
    linkedin: string;
    twitter: string;
    website: string;
    email: string;
    order: number;
    featured: boolean;
    enabled: boolean;
  }>;
  timeline: Array<{
    id: string;
    year: string;
    title: string;
    description: string;
    image?: string;
    icon?: string;
    order: number;
    enabled: boolean;
  }>;
  locations: Array<{
    id: string;
    officeName: string;
    city: string;
    state: string;
    country: string;
    address: string;
    mapUrl: string;
    phone: string;
    email: string;
    order: number;
    enabled: boolean;
  }>;
  certifications: Array<{
    id: string;
    logo: string;
    name: string;
    description: string;
    verificationUrl: string;
    year: string;
    order: number;
    enabled: boolean;
  }>;
  cta: {
    badge: string;
    heading: string;
    description: string;
    primaryCtaLabel: string;
    primaryCtaUrl: string;
    secondaryCtaLabel: string;
    secondaryCtaUrl: string;
    style: "minimal" | "brand" | "image";
    backgroundImage: string;
    enabled: boolean;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
    robots: string;
  };
  publishing: {
    status: "published" | "draft" | "scheduled";
    publishedAt: string | null;
    publishedBy: string | null;
    scheduledAt: string | null;
    visibility: "public" | "private" | "hidden";
  };
}

export const DEFAULT_ABOUT_PAGE: AboutPageContent = {
  version: 1,
  hero: {
    eyebrow: "About Go Experts",
    heading: "Building Better Connections Between Talent, Businesses and Opportunities",
    highlightText: "Talent, Businesses and Opportunities",
    description: "We are on a mission to democratize elite professional services, enabling startups, enterprises, freelancers, and investors to collaborate seamlessly worldwide.",
    primaryCtaLabel: "Explore Platform",
    primaryCtaUrl: "/register",
    secondaryCtaLabel: "Contact Us",
    secondaryCtaUrl: "/contact",
    image: "",
    imageAlt: "Go Experts executive team collaborating in a modern office environment",
    enabled: true,
  },
  introduction: {
    badge: "Who We Are",
    heading: "Architecting the Future of High-Trust Digital Work",
    summary: "Go Experts is an enterprise ecosystem connecting verified global talent with visionary founders, corporate clients, and strategic investors.",
    description: "Founded in 2016, Go Experts has grown from a specialized talent marketplace into an end-to-end operational platform. We combine AI-powered skill matching, transparent milestone payments, and rigorous background verification to eliminate friction in international contracts.",
    image: "",
    imageAlt: "Strategic planning workshop at Go Experts headquarters",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    layout: "image_right",
    enabled: true,
  },
  missionVision: {
    mission: {
      icon: "Target",
      title: "Our Mission",
      description: "To empower world-class talent and high-growth organizations with transparent, frictionless digital infrastructure that turns bold ideas into global market leaders.",
      ctaLabel: "Learn Our Strategy",
      ctaUrl: "/how-it-works",
    },
    vision: {
      icon: "Compass",
      title: "Our Vision",
      description: "To become the default global OS for borderless work and venture execution, connecting 1 million+ professionals across 100+ countries by 2030.",
      ctaLabel: "View Roadmap",
      ctaUrl: "/careers",
    },
    enabled: true,
  },
  story: {
    badge: "Our Heritage",
    heading: "From a Single Office to a Global Talent Network",
    content: "In 2016, our founders recognized a critical flaw in global hiring: traditional agency models were too slow, while existing gig portals lacked trust and compliance. Go Experts was built to bridge that gap with verified identity credentials, enterprise escrow protections, and transparent project milestones.",
    image: "",
    imageAlt: "Early days of Go Experts product innovation team",
    enabled: true,
  },
  coreValues: [
    {
      id: "val_1",
      icon: "ShieldCheck",
      title: "Trust & Radical Transparency",
      description: "We build enduring partnerships through honest metrics, clear pricing structures, and verifiable credentials.",
      order: 1,
      enabled: true,
    },
    {
      id: "val_2",
      icon: "Zap",
      title: "Relentless Technological Innovation",
      description: "We constantly refine our AI matching algorithms, workspace tools, and security standards to deliver superior outcomes.",
      order: 2,
      enabled: true,
    },
    {
      id: "val_3",
      icon: "Users",
      title: "Empowerment & Inclusion",
      description: "Great talent is evenly distributed across the globe. We provide equal access to premium economic opportunities regardless of location.",
      order: 3,
      enabled: true,
    },
    {
      id: "val_4",
      icon: "Award",
      title: "Excellence Without Compromise",
      description: "Every code snippet, contract template, and support interaction must meet elite enterprise quality benchmarks.",
      order: 4,
      enabled: true,
    },
  ],
  statistics: [
    {
      id: "stat_1",
      value: "10+",
      suffix: "Years",
      label: "Industry Leadership",
      icon: "Calendar",
      order: 1,
      enabled: true,
    },
    {
      id: "stat_2",
      value: "50K+",
      suffix: "Members",
      label: "Verified Users & Experts",
      icon: "Users",
      order: 2,
      enabled: true,
    },
    {
      id: "stat_3",
      value: "100+",
      suffix: "Categories",
      label: "Specialized Skill Domains",
      icon: "Layers",
      order: 3,
      enabled: true,
    },
    {
      id: "stat_4",
      value: "20+",
      suffix: "Countries",
      label: "Global Presence & Hubs",
      icon: "Globe",
      order: 4,
      enabled: true,
    },
  ],
  whyChooseUs: [
    {
      id: "why_1",
      icon: "ShieldAlert",
      title: "Vetted & Identity-Verified Talent",
      description: "Rigorous background checks, portfolio assessments, and technical skill evaluations before approval.",
      linkUrl: "/freelancers",
      order: 1,
      enabled: true,
    },
    {
      id: "why_2",
      icon: "Lock",
      title: "Enterprise Milestone Escrow",
      description: "Funds are securely locked in compliant escrow accounts and released only when milestones are approved.",
      linkUrl: "/pricing",
      order: 2,
      enabled: true,
    },
    {
      id: "why_3",
      icon: "Sparkles",
      title: "AI-Powered Instant Matching",
      description: "Intelligent vector matching connects project requirements with candidate availability within minutes.",
      linkUrl: "/post-project",
      order: 3,
      enabled: true,
    },
    {
      id: "why_4",
      icon: "Headphones",
      title: "Dedicated 24/7 Priority Support",
      description: "Direct access to dedicated account managers and technical dispute resolution specialists.",
      linkUrl: "/contact",
      order: 4,
      enabled: true,
    },
  ],
  teamMembers: [
    {
      id: "team_1",
      photo: "",
      name: "Dr. Sarah Jenkins",
      designation: "Chief Executive Officer & Founder",
      department: "Executive Leadership",
      bio: "Former Tech VP with 15+ years experience building international SaaS platforms and scaling enterprise networks.",
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com",
      website: "https://sarahjenkins.io",
      email: "sarah@goexperts.in",
      order: 1,
      featured: true,
      enabled: true,
    },
    {
      id: "team_2",
      photo: "",
      name: "Rajesh V. Kumar",
      designation: "Chief Technology Officer",
      department: "Engineering & AI",
      bio: "Specialist in distributed systems, high-concurrency cloud infrastructure, and predictive machine learning models.",
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com",
      website: "https://goexperts.in",
      email: "rajesh@goexperts.in",
      order: 2,
      featured: true,
      enabled: true,
    },
    {
      id: "team_3",
      photo: "",
      name: "Elena Rostova",
      designation: "Head of Product & Design",
      department: "Product UX",
      bio: "Design architect formerly leading UX teams at top-tier European SaaS companies.",
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com",
      website: "https://goexperts.in",
      email: "elena@goexperts.in",
      order: 3,
      featured: true,
      enabled: true,
    },
    {
      id: "team_4",
      photo: "",
      name: "Marcus Vance",
      designation: "VP of Global Growth & Strategic Partnerships",
      department: "Business Operations",
      bio: "Veteran growth strategist driving platform expansion across EMEA and North America market segments.",
      linkedin: "https://linkedin.com",
      twitter: "https://twitter.com",
      website: "https://goexperts.in",
      email: "marcus@goexperts.in",
      order: 4,
      featured: false,
      enabled: true,
    },
  ],
  timeline: [
    {
      id: "time_1",
      year: "2016",
      title: "Company Founded",
      description: "Established in Bengaluru with a core team of 5 engineers to modernize high-end tech consulting.",
      order: 1,
      enabled: true,
    },
    {
      id: "time_2",
      year: "2019",
      title: "Cross-Border Escrow Launch",
      description: "Introduced automated multi-currency escrow payments and contract milestone verification.",
      order: 2,
      enabled: true,
    },
    {
      id: "time_3",
      year: "2023",
      title: "Global Enterprise Platform",
      description: "Expanded into 20+ major tech hubs with integrated Founder-Investor matching networks.",
      order: 3,
      enabled: true,
    },
    {
      id: "time_4",
      year: "2026",
      title: "Phase 2B AI Ecosystem",
      description: "Deployed next-gen AI workspace tools, automated governance, and MNC-grade Super Admin controls.",
      order: 4,
      enabled: true,
    },
  ],
  locations: [
    {
      id: "loc_1",
      officeName: "Global Headquarters",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      address: "100 Feet Road, Indiranagar, Bengaluru - 560038",
      mapUrl: "https://maps.google.com",
      phone: "+91 80 4567 8900",
      email: "hq@goexperts.in",
      order: 1,
      enabled: true,
    },
    {
      id: "loc_2",
      officeName: "North America Hub",
      city: "San Francisco",
      state: "California",
      country: "United States",
      address: "500 Howard Street, Suite 400, San Francisco, CA 94105",
      mapUrl: "https://maps.google.com",
      phone: "+1 (415) 890-1234",
      email: "us@goexperts.in",
      order: 2,
      enabled: true,
    },
    {
      id: "loc_3",
      officeName: "EMEA Regional Office",
      city: "London",
      state: "Greater London",
      country: "United Kingdom",
      address: "1 Canada Square, Canary Wharf, London E14 5AA",
      mapUrl: "https://maps.google.com",
      phone: "+44 20 7946 0912",
      email: "uk@goexperts.in",
      order: 3,
      enabled: true,
    },
  ],
  certifications: [
    {
      id: "cert_1",
      logo: "",
      name: "ISO/IEC 27001:2022 Certified",
      description: "International standard for Information Security Management Systems (ISMS).",
      verificationUrl: "https://iso.org",
      year: "2024",
      order: 1,
      enabled: true,
    },
    {
      id: "cert_2",
      logo: "",
      name: "SOC 2 Type II Compliant",
      description: "Audited for operational security, availability, and data confidentiality controls.",
      verificationUrl: "https://aicpa.org",
      year: "2025",
      order: 2,
      enabled: true,
    },
    {
      id: "cert_3",
      logo: "",
      name: "GDPR & CCPA Compliant",
      description: "Full compliance with European Union and California privacy data rights.",
      verificationUrl: "https://gdpr.eu",
      year: "2026",
      order: 3,
      enabled: true,
    },
  ],
  cta: {
    badge: "Join Go Experts",
    heading: "Ready to Build Your Next Big Milestone With Go Experts?",
    description: "Connect with verified professionals, post projects, or secure strategic startup funding today.",
    primaryCtaLabel: "Get Started Now",
    primaryCtaUrl: "/register",
    secondaryCtaLabel: "Schedule a Demo",
    secondaryCtaUrl: "/contact",
    style: "brand",
    backgroundImage: "",
    enabled: true,
  },
  seo: {
    metaTitle: "About Us — Go Experts Enterprise Platform",
    metaDescription: "Go Experts is an enterprise platform connecting verified talent, ambitious clients, startup founders, and strategic investors worldwide.",
    keywords: ["Go Experts", "About Us", "Freelancer Platform", "Startup Founders", "Investors", "Enterprise Hiring"],
    canonicalUrl: "https://goexperts.in/about",
    ogTitle: "About Go Experts — Building the Future of Borderless Work",
    ogDescription: "Discover how Go Experts powers enterprise hiring, project escrow, and startup venture execution.",
    ogImage: "",
    robots: "index, follow",
  },
  publishing: {
    status: "published",
    publishedAt: new Date().toISOString(),
    publishedBy: "Super Admin",
    scheduledAt: null,
    visibility: "public",
  },
};

export class AboutCmsService {
  private static PAGE_NAME = "About Us";
  private static PAGE_CATEGORY = "Company Pages";

  /**
   * Helper to ensure the About Us page record exists in database
   */
  private async getOrCreatePage() {
    let page = await prisma.cmsPage.findFirst({
      where: {
        OR: [
          { name: { equals: "About" } },
          { name: { equals: "About Us" } },
        ],
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!page) {
      const defaultStr = JSON.stringify(DEFAULT_ABOUT_PAGE);
      page = await prisma.cmsPage.create({
        data: {
          name: AboutCmsService.PAGE_NAME,
          category: AboutCmsService.PAGE_CATEGORY,
          status: "published",
          draftJson: defaultStr,
          publishedJson: defaultStr,
          version: 1,
          publishedAt: new Date(),
          publishedBy: "System",
          content: defaultStr,
        },
      });

      // Also create initial revision 1
      await prisma.cmsPageRevision.create({
        data: {
          pageId: page.id,
          version: 1,
          contentJson: defaultStr,
          status: "published",
          createdBy: "System Initializer",
          changeSummary: "Initial System Master Template Created",
        },
      });
    }

    return page;
  }

  /**
   * Admin: Get draft & metadata + version history overview
   */
  async getAdminAboutPage() {
    const page = await this.getOrCreatePage();

    let draftContent: AboutPageContent = DEFAULT_ABOUT_PAGE;
    try {
      if (page.draftJson) {
        draftContent = JSON.parse(page.draftJson);
      } else if (page.content && page.content.trim().startsWith("{")) {
        draftContent = JSON.parse(page.content);
      }
    } catch {
      draftContent = DEFAULT_ABOUT_PAGE;
    }

    return {
      pageId: page.id,
      name: page.name,
      category: page.category,
      status: page.status,
      version: page.version,
      publishedAt: page.publishedAt,
      publishedBy: page.publishedBy,
      updatedAt: page.updatedAt,
      draftContent,
      publishedContent: page.publishedJson ? JSON.parse(page.publishedJson) : null,
    };
  }

  /**
   * Admin: Save Active Draft (Optimistic Concurrency Control)
   */
  async saveDraft(draftContent: AboutPageContent, expectedVersion?: number, adminId?: string) {
    const page = await this.getOrCreatePage();

    if (expectedVersion !== undefined && expectedVersion !== page.version) {
      throw new Error(`CONCURRENCY_CONFLICT: Server version is v${page.version}, but draft was based on v${expectedVersion}. Please reload.`);
    }

    const jsonStr = JSON.stringify(draftContent);

    const updated = await prisma.cmsPage.update({
      where: { id: page.id },
      data: {
        draftJson: jsonStr,
        content: jsonStr,
        updatedAt: new Date(),
      },
    });

    if (adminId) {
      await prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: "ABOUT_PAGE_DRAFT_SAVED",
          entity: "CmsPage",
          entityId: page.id,
          diff: `Draft saved for About Us (v${page.version})`,
        },
      }).catch(() => {});
    }

    return {
      success: true,
      version: updated.version,
      updatedAt: updated.updatedAt,
      message: "Draft saved successfully",
    };
  }

  /**
   * Admin: Transactional Publish
   */
  async publishChanges(content: AboutPageContent, adminId?: string, adminName: string = "Super Admin") {
    const page = await this.getOrCreatePage();

    const nextVersion = page.version + 1;

    content.version = nextVersion;
    content.publishing = {
      status: "published",
      publishedAt: new Date().toISOString(),
      publishedBy: adminName,
      scheduledAt: null,
      visibility: "public",
    };

    const jsonStr = JSON.stringify(content);

    return await prisma.$transaction(async (tx) => {
      const updatedPage = await tx.cmsPage.update({
        where: { id: page.id },
        data: {
          draftJson: jsonStr,
          publishedJson: jsonStr,
          content: jsonStr,
          version: nextVersion,
          status: "published",
          publishedAt: new Date(),
          publishedBy: adminName,
          updatedAt: new Date(),
        },
      });

      const revision = await tx.cmsPageRevision.create({
        data: {
          pageId: page.id,
          version: nextVersion,
          contentJson: jsonStr,
          status: "published",
          createdBy: adminName,
          changeSummary: `Published Version ${nextVersion}`,
        },
      });

      if (adminId) {
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: "ABOUT_PAGE_PUBLISHED",
            entity: "CmsPage",
            entityId: page.id,
            diff: `Published Version ${nextVersion} by ${adminName}`,
          },
        }).catch(() => {});
      }

      return {
        success: true,
        version: updatedPage.version,
        publishedAt: updatedPage.publishedAt,
        revisionId: revision.id,
        message: "About page published successfully!",
      };
    });
  }

  /**
   * Admin: Fetch Revisions List
   */
  async getRevisions() {
    const page = await this.getOrCreatePage();

    const revisions = await prisma.cmsPageRevision.findMany({
      where: { pageId: page.id },
      orderBy: { version: "desc" },
      take: 50,
    });

    return revisions.map((rev) => ({
      id: rev.id,
      version: rev.version,
      createdBy: rev.createdBy || "Super Admin",
      createdAt: rev.createdAt,
      changeSummary: rev.changeSummary,
      isCurrent: rev.version === page.version,
    }));
  }

  /**
   * Admin: Get Revision Detail
   */
  async getRevisionById(revisionId: string) {
    const rev = await prisma.cmsPageRevision.findUnique({
      where: { id: revisionId },
    });

    if (!rev) throw new Error("Revision not found");

    let content: AboutPageContent = DEFAULT_ABOUT_PAGE;
    try {
      content = JSON.parse(rev.contentJson);
    } catch {
      content = DEFAULT_ABOUT_PAGE;
    }

    return {
      id: rev.id,
      version: rev.version,
      createdBy: rev.createdBy,
      createdAt: rev.createdAt,
      changeSummary: rev.changeSummary,
      content,
    };
  }

  /**
   * Admin: Restore Revision to Draft
   */
  async restoreRevisionToDraft(revisionId: string, adminId?: string) {
    const rev = await this.getRevisionById(revisionId);
    const page = await this.getOrCreatePage();

    const restoredContent = rev.content;
    restoredContent.publishing.status = "draft";
    const restoredStr = JSON.stringify(restoredContent);

    await prisma.cmsPage.update({
      where: { id: page.id },
      data: {
        draftJson: restoredStr,
        content: restoredStr,
        updatedAt: new Date(),
      },
    });

    if (adminId) {
      await prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: "ABOUT_PAGE_REVISION_RESTORED",
          entity: "CmsPage",
          entityId: page.id,
          diff: `Restored Version ${rev.version} into active draft`,
        },
      }).catch(() => {});
    }

    return {
      success: true,
      restoredVersion: rev.version,
      draftContent: restoredContent,
      message: `Version ${rev.version} restored into active draft. Preview or click Publish to apply to live site.`,
    };
  }

  /**
   * Public: Get Published About Page Payload
   */
  async getPublicAboutPage() {
    const page = await this.getOrCreatePage();

    let isHtmlContent = false;
    let rawContentStr = page.publishedJson || page.content || page.draftJson || "";

    if (rawContentStr && (rawContentStr.trim().startsWith("<") || rawContentStr.trim().startsWith("{") === false)) {
      isHtmlContent = true;
    }

    if (isHtmlContent) {
      return {
        success: true,
        data: {
          contentType: "html",
          htmlContent: rawContentStr,
          updatedAt: page.updatedAt,
        },
      };
    }

    let content: AboutPageContent = DEFAULT_ABOUT_PAGE;
    try {
      if (rawContentStr) {
        content = JSON.parse(rawContentStr);
      }
    } catch {
      content = DEFAULT_ABOUT_PAGE;
    }

    return {
      success: true,
      data: {
        contentType: "json",
        version: content.version,
        publishedAt: content.publishing?.publishedAt || page.publishedAt,
        hero: content.hero?.enabled !== false ? content.hero : null,
        introduction: content.introduction?.enabled !== false ? content.introduction : null,
        missionVision: content.missionVision?.enabled !== false ? content.missionVision : null,
        story: content.story?.enabled !== false ? content.story : null,
        coreValues: (content.coreValues || []).filter((v) => v.enabled !== false).sort((a, b) => a.order - b.order),
        statistics: (content.statistics || []).filter((s) => s.enabled !== false).sort((a, b) => a.order - b.order),
        whyChooseUs: (content.whyChooseUs || []).filter((w) => w.enabled !== false).sort((a, b) => a.order - b.order),
        teamMembers: (content.teamMembers || []).filter((t) => t.enabled !== false).sort((a, b) => a.order - b.order),
        timeline: (content.timeline || []).filter((tm) => tm.enabled !== false).sort((a, b) => a.order - b.order),
        locations: (content.locations || []).filter((l) => l.enabled !== false).sort((a, b) => a.order - b.order),
        certifications: (content.certifications || []).filter((c) => c.enabled !== false).sort((a, b) => a.order - b.order),
        cta: content.cta?.enabled !== false ? content.cta : null,
        seo: content.seo || DEFAULT_ABOUT_PAGE.seo,
      },
    };
  }
}

export const aboutCmsService = new AboutCmsService();
