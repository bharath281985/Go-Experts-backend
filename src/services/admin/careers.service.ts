import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CareersPageContent {
  hero: {
    eyebrow: string;
    heading: string;
    highlightText: string;
    description: string;
    image?: string;
    imageAlt?: string;
    primaryCtaLabel?: string;
    primaryCtaUrl?: string;
    secondaryCtaLabel?: string;
    secondaryCtaUrl?: string;
    enabled: boolean;
  };
  whyJoinUs: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    order: number;
    enabled: boolean;
  }>;
  culture: {
    title: string;
    description: string;
    videoUrl?: string;
    valuesList: string[];
    enabled: boolean;
  };
  benefits: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    order: number;
    enabled: boolean;
  }>;
  hiringProcess: Array<{
    stepNumber: number;
    icon: string;
    title: string;
    description: string;
    order: number;
    enabled: boolean;
  }>;
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
    order: number;
  }>;
  seo: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
  };
}

const PAGE_NAME = "Careers";
const PAGE_CATEGORY = "Company";

function generateApplicationNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `GE-CAR-${dateStr}-${randomNum}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class CareersCmsService {
  /**
   * Ensure Careers CMS Page record exists
   */
  private async getOrCreatePage() {
    let page = await prisma.cmsPage.findFirst({
      where: {
        name: { equals: PAGE_NAME },
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!page) {
      const initialPayload: CareersPageContent = {
        hero: {
          eyebrow: "Build What's Next",
          heading: "Join a Team Solving Meaningful Problems Worldwide",
          highlightText: "Meaningful Problems Worldwide",
          description: "We are architecting the future of global borderless work. Discover fast-paced, high-ownership career opportunities across engineering, product, trust & safety, and growth.",
          image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
          imageAlt: "Go Experts Careers Team",
          primaryCtaLabel: "View Open Roles",
          primaryCtaUrl: "#open-positions",
          secondaryCtaLabel: "Our Culture",
          secondaryCtaUrl: "#company-culture",
          enabled: true,
        },
        whyJoinUs: [
          { id: "w-1", icon: "Rocket", title: "High Ownership & Impact", description: "Ship real features that touch thousands of founders, freelancers, and enterprise customers globaly.", order: 1, enabled: true },
          { id: "w-2", icon: "Globe2", title: "Remote-First Environment", description: "Work from wherever you perform best with flexible working hours and asynchronous collaboration tools.", order: 2, enabled: true },
          { id: "w-3", icon: "TrendingUp", title: "Rapid Career Trajectory", description: "Fast-track your professional growth with mentorship, competitive equity grants, and clear career ladders.", order: 3, enabled: true },
        ],
        culture: {
          title: "Rooted in Trust, Transparency & Speed",
          description: "We foster an autonomous, low-friction work culture where great ideas win regardless of seniority or title. We celebrate transparency, relentless execution, and high psychological safety.",
          valuesList: ["Customer First", "Extreme Ownership", "Default to Open", "Radical Simplicity"],
          enabled: true,
        },
        benefits: [
          { id: "b-1", icon: "Banknote", title: "Competitive Salary & Equity", description: "Top 10% market compensation with generous stock option packages for all full-time employees.", order: 1, enabled: true },
          { id: "b-2", icon: "HeartHandshake", title: "Comprehensive Healthcare", description: "Premium medical, dental, and mental health coverage for you and your dependents.", order: 2, enabled: true },
          { id: "b-3", icon: "Sparkles", title: "Annual Learning Stipend", description: "$1,500 annual budget for conferences, courses, books, and professional certifications.", order: 3, enabled: true },
          { id: "b-4", icon: "Coffee", title: "Home Office Setup", description: "$1,000 one-time setup allowance + modern MacBook Pro hardware provided on Day 1.", order: 4, enabled: true },
        ],
        hiringProcess: [
          { stepNumber: 1, icon: "FileText", title: "1. Online Application", description: "Submit your resume and portfolio via our careers portal.", order: 1, enabled: true },
          { stepNumber: 2, icon: "Headphones", title: "2. Recruiter Recruiter Call", description: "30-minute introductory call to align on role fit, culture, and expectations.", order: 2, enabled: true },
          { stepNumber: 3, icon: "Code", title: "3. Technical Assessment", description: "Practical hands-on task or architecture discussion related to daily work.", order: 3, enabled: true },
          { stepNumber: 4, icon: "Users", title: "4. Team Interviews", description: "Deep-dive sessions with future teammates and cross-functional partners.", order: 4, enabled: true },
          { stepNumber: 5, icon: "CheckCircle2", title: "5. Official Offer", description: "Competitive offer extended with full compensation and benefits overview.", order: 5, enabled: true },
        ],
        faqs: [
          { id: "f-1", question: "Can I work remotely from outside India?", answer: "Yes! Over 60% of our engineering and product teams work remotely across North America, Europe, Southeast Asia, and India.", order: 1 },
          { id: "f-2", question: "What is the typical interview process timeline?", answer: "Our hiring process is designed to be fast and respectful. Most candidates complete all stages within 10 to 14 business days.", order: 2 },
        ],
        seo: {
          metaTitle: "Careers at Go Experts — Join Our Global Team",
          metaDescription: "Explore open remote and hybrid positions at Go Experts. Work on borderless talent infrastructure, AI matching, and escrow platform technology.",
          canonicalUrl: "https://goexperts.in/careers",
          ogTitle: "Careers — Build the Future of Work at Go Experts",
          ogDescription: "We are hiring engineers, product designers, and growth leaders.",
        },
      };

      const payloadStr = JSON.stringify(initialPayload);
      page = await prisma.cmsPage.create({
        data: {
          name: PAGE_NAME,
          category: PAGE_CATEGORY,
          status: "active",
          draftJson: payloadStr,
          publishedJson: payloadStr,
          version: 1,
          publishedAt: new Date(),
          publishedBy: "System",
          content: payloadStr,
        },
      });
    }

    return page;
  }

  /**
   * Public: Get Careers Page Payload
   */
  async getPublicCareersPage() {
    const page = await this.getOrCreatePage();
    let contentStr = page.publishedJson || page.content || page.draftJson || "";
    let parsed: any = null;

    try {
      if (contentStr && contentStr.trim().startsWith("{")) {
        parsed = JSON.parse(contentStr);
      }
    } catch {
      parsed = null;
    }

    if (parsed) {
      return { success: true, data: parsed };
    }

    return {
      success: true,
      data: {
        contentType: "html",
        content: contentStr,
      },
    };
  }

  /**
   * Admin: Get Careers CMS Page
   */
  async getAdminCareersPage() {
    const page = await this.getOrCreatePage();
    let draftData: any = null;
    let publishedData: any = null;

    try {
      if (page.draftJson) draftData = JSON.parse(page.draftJson);
    } catch {}

    try {
      if (page.publishedJson) publishedData = JSON.parse(page.publishedJson);
    } catch {}

    return {
      pageId: page.id,
      name: page.name,
      category: page.category,
      status: page.status,
      version: page.version,
      updatedAt: page.updatedAt,
      publishedAt: page.publishedAt,
      draftContent: draftData,
      publishedContent: publishedData,
    };
  }

  /**
   * Admin: Save Careers Page Draft
   */
  async saveCareersDraft(payload: any) {
    const page = await this.getOrCreatePage();
    const str = JSON.stringify(payload);

    const updated = await prisma.cmsPage.update({
      where: { id: page.id },
      data: { draftJson: str, updated: new Date().toISOString().slice(0, 10) },
    });

    return { success: true, pageId: updated.id, version: updated.version };
  }

  /**
   * Admin: Publish Careers Page
   */
  async publishCareersPage(payload: any, adminName: string = "Admin") {
    const page = await this.getOrCreatePage();
    const str = JSON.stringify(payload);
    const newVersion = (page.version || 1) + 1;

    const updated = await prisma.cmsPage.update({
      where: { id: page.id },
      data: {
        draftJson: str,
        publishedJson: str,
        content: str,
        version: newVersion,
        status: "active",
        publishedAt: new Date(),
        publishedBy: adminName,
        updated: new Date().toISOString().slice(0, 10),
      },
    });

    return { success: true, pageId: updated.id, version: newVersion };
  }

  /* ============================================================ */
  /* 💼 JOB OPENINGS METHODS                                      */
  /* ============================================================ */

  /**
   * Helper to seed initial jobs if empty
   */
  private async seedDefaultJobsIfEmpty() {
    const count = await prisma.jobOpening.count({ where: { deletedAt: null } });
    if (count === 0) {
      const defaults = [
        {
          title: "Senior Product Engineer",
          slug: "senior-product-engineer",
          jobCode: "JOB-ENG-001",
          department: "Engineering",
          category: "Software Development",
          location: "Remote (Global)",
          workplaceType: "remote",
          employmentType: "full_time",
          experienceLevel: "senior",
          minExperience: 5,
          maxExperience: 8,
          openings: 2,
          salaryMin: 120000,
          salaryMax: 160000,
          currency: "USD",
          salaryVisibility: true,
          shortSummary: "Lead the full-stack architecture of our core Web & API platforms using React, Node.js, and TypeScript.",
          fullDescription: "We are seeking a Senior Product Engineer to lead the architecture and development of our core web ecosystem...",
          responsibilities: "• Architect scalable web services\n• Collaborate with Product & Design\n• Maintain high unit test coverage",
          requirements: "• 5+ years with React and TypeScript\n• Experience building REST/GraphQL APIs\n• High autonomy",
          benefits: "• Top tier salary & equity\n• $1,500 annual learning budget\n• Flexible remote work",
          status: "published",
          featured: true,
        },
        {
          title: "Product Designer (Design Systems)",
          slug: "product-designer-design-systems",
          jobCode: "JOB-DES-002",
          department: "Design",
          category: "UI/UX Design",
          location: "Bengaluru, India / Hybrid",
          workplaceType: "hybrid",
          employmentType: "full_time",
          experienceLevel: "mid_level",
          minExperience: 3,
          maxExperience: 6,
          openings: 1,
          salaryMin: 40000,
          salaryMax: 65000,
          currency: "USD",
          salaryVisibility: true,
          shortSummary: "Craft intuitive, world-class design systems and component libraries across web and mobile surfaces.",
          fullDescription: "Join our core design team to establish and evolve the Go Experts Design System...",
          responsibilities: "• Evolve component guidelines in Figma\n• Conduct user research & usability testing\n• Partner with frontend engineers",
          requirements: "• 3+ years in SaaS product design\n• Mastery of Figma & prototyping\n• Portfolio demonstrating systems thinking",
          benefits: "• Premium health insurance\n• Modern hardware of choice",
          status: "published",
          featured: true,
        },
        {
          title: "Trust & Safety Lead",
          slug: "trust-and-safety-lead",
          jobCode: "JOB-TRU-003",
          department: "Trust & Operations",
          category: "Risk & Verification",
          location: "Singapore / Remote",
          workplaceType: "remote",
          employmentType: "full_time",
          experienceLevel: "lead",
          minExperience: 6,
          maxExperience: 10,
          openings: 1,
          salaryMin: 90000,
          salaryMax: 130000,
          currency: "USD",
          salaryVisibility: true,
          shortSummary: "Lead platform risk mitigation, identity verification protocols, and payment dispute resolution.",
          fullDescription: "We are hiring a Trust & Safety Lead to protect our global marketplace...",
          responsibilities: "• Define KYC/AML verification policies\n• Oversee dispute resolution workflows\n• Manage risk analytics",
          requirements: "• 6+ years in marketplace or Fintech risk management\n• Strong knowledge of regulatory compliance",
          benefits: "• Equity options\n• Unlimited PTO policy",
          status: "published",
          featured: false,
        },
      ];

      for (const job of defaults) {
        await prisma.jobOpening.create({ data: job });
      }
    }
  }

  /**
   * Public: List Active Published Jobs with filters
   */
  async listPublicJobs(filters: { search?: string; department?: string; location?: string; workplaceType?: string; employmentType?: string }) {
    await this.seedDefaultJobsIfEmpty();

    const where: any = {
      status: "published",
      deletedAt: null,
    };

    if (filters.department && filters.department !== "all") {
      where.department = { equals: filters.department };
    }
    if (filters.location && filters.location !== "all") {
      where.location = { contains: filters.location };
    }
    if (filters.workplaceType && filters.workplaceType !== "all") {
      where.workplaceType = filters.workplaceType;
    }
    if (filters.employmentType && filters.employmentType !== "all") {
      where.employmentType = filters.employmentType;
    }
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q } },
        { shortSummary: { contains: q } },
        { department: { contains: q } },
      ];
    }

    const jobs = await prisma.jobOpening.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });

    return { success: true, count: jobs.length, data: jobs };
  }

  /**
   * Public: Get Single Job by Slug
   */
  async getPublicJobBySlug(slug: string) {
    await this.seedDefaultJobsIfEmpty();

    const job = await prisma.jobOpening.findFirst({
      where: {
        slug: { equals: slug },
        deletedAt: null,
      },
    });

    if (!job) {
      throw new Error(`Job position '${slug}' not found or is no longer open.`);
    }

    return { success: true, data: job };
  }

  /**
   * Admin: List Jobs with server-side pagination & stats
   */
  async listAdminJobs(params: { page?: number; pageSize?: number; search?: string; status?: string; department?: string }) {
    await this.seedDefaultJobsIfEmpty();

    const page = Number(params.page || 1);
    const pageSize = Number(params.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const where: any = { deletedAt: null };

    if (params.status && params.status !== "all") {
      where.status = params.status;
    }
    if (params.department && params.department !== "all") {
      where.department = params.department;
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q } },
        { jobCode: { contains: q } },
        { department: { contains: q } },
      ];
    }

    const [total, rows, activeCount, draftCount, closedCount, totalApps] = await Promise.all([
      prisma.jobOpening.count({ where }),
      prisma.jobOpening.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.jobOpening.count({ where: { deletedAt: null, status: "published" } }),
      prisma.jobOpening.count({ where: { deletedAt: null, status: "draft" } }),
      prisma.jobOpening.count({ where: { deletedAt: null, status: "closed" } }),
      prisma.careerApplication.count({ where: { deletedAt: null } }),
    ]);

    return {
      success: true,
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        active: activeCount,
        draft: draftCount,
        closed: closedCount,
        totalApplications: totalApps,
      },
    };
  }

  /**
   * Admin: Create Job Opening
   */
  async createJob(data: any) {
    if (!data.title || !data.department || !data.location || !data.shortSummary || !data.fullDescription) {
      throw new Error("Job Title, Department, Location, Short Summary, and Full Description are required.");
    }

    const baseSlug = slugify(data.title);
    let uniqueSlug = baseSlug;
    let counter = 1;

    while (await prisma.jobOpening.findFirst({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const job = await prisma.jobOpening.create({
      data: {
        title: data.title.trim(),
        slug: uniqueSlug,
        jobCode: data.jobCode?.trim() || `JOB-${Date.now().toString().slice(-4)}`,
        department: data.department.trim(),
        category: data.category?.trim() || null,
        location: data.location.trim(),
        workplaceType: data.workplaceType || "hybrid",
        employmentType: data.employmentType || "full_time",
        experienceLevel: data.experienceLevel || "mid_level",
        minExperience: data.minExperience ? Number(data.minExperience) : null,
        maxExperience: data.maxExperience ? Number(data.maxExperience) : null,
        openings: Number(data.openings || 1),
        salaryMin: data.salaryMin ? Number(data.salaryMin) : null,
        salaryMax: data.salaryMax ? Number(data.salaryMax) : null,
        currency: data.currency || "USD",
        salaryVisibility: Boolean(data.salaryVisibility),
        shortSummary: data.shortSummary.trim(),
        fullDescription: data.fullDescription.trim(),
        responsibilities: data.responsibilities?.trim() || null,
        requirements: data.requirements?.trim() || null,
        preferredQualifications: data.preferredQualifications?.trim() || null,
        benefits: data.benefits?.trim() || null,
        status: data.status || "published",
        featured: Boolean(data.featured),
      },
    });

    return { success: true, data: job };
  }

  /**
   * Admin: Update Job Opening
   */
  async updateJob(id: string, data: any) {
    const existing = await prisma.jobOpening.findUnique({ where: { id } });
    if (!existing) throw new Error("Job opening not found.");

    const updated = await prisma.jobOpening.update({
      where: { id },
      data: {
        title: data.title ? data.title.trim() : existing.title,
        department: data.department ? data.department.trim() : existing.department,
        location: data.location ? data.location.trim() : existing.location,
        workplaceType: data.workplaceType || existing.workplaceType,
        employmentType: data.employmentType || existing.employmentType,
        experienceLevel: data.experienceLevel || existing.experienceLevel,
        minExperience: data.minExperience !== undefined ? Number(data.minExperience) : existing.minExperience,
        maxExperience: data.maxExperience !== undefined ? Number(data.maxExperience) : existing.maxExperience,
        openings: data.openings !== undefined ? Number(data.openings) : existing.openings,
        salaryMin: data.salaryMin !== undefined ? Number(data.salaryMin) : existing.salaryMin,
        salaryMax: data.salaryMax !== undefined ? Number(data.salaryMax) : existing.salaryMax,
        currency: data.currency || existing.currency,
        salaryVisibility: data.salaryVisibility !== undefined ? Boolean(data.salaryVisibility) : existing.salaryVisibility,
        shortSummary: data.shortSummary ? data.shortSummary.trim() : existing.shortSummary,
        fullDescription: data.fullDescription ? data.fullDescription.trim() : existing.fullDescription,
        responsibilities: data.responsibilities !== undefined ? data.responsibilities : existing.responsibilities,
        requirements: data.requirements !== undefined ? data.requirements : existing.requirements,
        benefits: data.benefits !== undefined ? data.benefits : existing.benefits,
        status: data.status || existing.status,
        featured: data.featured !== undefined ? Boolean(data.featured) : existing.featured,
      },
    });

    return { success: true, data: updated };
  }

  /**
   * Admin: Delete Job
   */
  async deleteJob(id: string) {
    await prisma.jobOpening.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });
    return { success: true, message: "Job archived successfully." };
  }

  /* ============================================================ */
  /* 📄 CAREER APPLICATIONS METHODS                               */
  /* ============================================================ */

  /**
   * Public: Submit Application for a Job
   */
  async submitCareerApplication(input: {
    jobId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    currentLocation?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    experienceYears?: number;
    currentCompany?: string;
    currentDesignation?: string;
    currentCtc?: string;
    expectedCtc?: string;
    noticePeriod?: string;
    preferredLocation?: string;
    coverLetter?: string;
    resumeUrl: string;
    resumeFileName?: string;
  }) {
    const job = await prisma.jobOpening.findUnique({ where: { id: input.jobId } });
    if (!job || job.status !== "published") {
      throw new Error("This job position is no longer accepting applications.");
    }

    // Duplicate check: email + jobId within 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const duplicate = await prisma.careerApplication.findFirst({
      where: {
        jobId: input.jobId,
        email: input.email.trim().toLowerCase(),
        createdAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new Error(`You have already submitted an application for '${job.title}' recently. Reference: ${duplicate.applicationNumber}`);
    }

    const applicationNumber = generateApplicationNumber();

    const application = await prisma.careerApplication.create({
      data: {
        applicationNumber,
        jobId: job.id,
        jobTitle: job.title,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        currentLocation: input.currentLocation?.trim() || null,
        linkedinUrl: input.linkedinUrl?.trim() || null,
        portfolioUrl: input.portfolioUrl?.trim() || null,
        experienceYears: input.experienceYears ? Number(input.experienceYears) : null,
        currentCompany: input.currentCompany?.trim() || null,
        currentDesignation: input.currentDesignation?.trim() || null,
        currentCtc: input.currentCtc?.trim() || null,
        expectedCtc: input.expectedCtc?.trim() || null,
        noticePeriod: input.noticePeriod?.trim() || null,
        preferredLocation: input.preferredLocation?.trim() || null,
        coverLetter: input.coverLetter?.trim() || null,
        resumeUrl: input.resumeUrl.trim(),
        resumeFileName: input.resumeFileName || "Resume.pdf",
        status: "new",
      },
    });

    // Increment application count on Job
    await prisma.jobOpening.update({
      where: { id: job.id },
      data: { applicationsCount: { increment: 1 } },
    });

    return {
      success: true,
      applicationNumber: application.applicationNumber,
      message: `Application submitted successfully! Your application reference number is ${application.applicationNumber}.`,
    };
  }

  /**
   * Admin: List Career Applications with server-side pagination & filters
   */
  async listCareerApplications(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    jobId?: string;
  }) {
    const page = Number(params.page || 1);
    const pageSize = Number(params.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const where: any = { deletedAt: null };

    if (params.status && params.status !== "all") {
      where.status = params.status;
    }
    if (params.jobId && params.jobId !== "all") {
      where.jobId = params.jobId;
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { applicationNumber: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { jobTitle: { contains: q } },
      ];
    }

    const [total, rows, newCount, reviewCount, shortlistedCount, hiredCount] = await Promise.all([
      prisma.careerApplication.count({ where }),
      prisma.careerApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "new" } }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "under_review" } }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "shortlisted" } }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "hired" } }),
    ]);

    return {
      success: true,
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        new: newCount,
        underReview: reviewCount,
        shortlisted: shortlistedCount,
        hired: hiredCount,
      },
    };
  }

  /**
   * Admin: Get Single Career Application Detail
   */
  async getCareerApplicationById(id: string) {
    const app = await prisma.careerApplication.findUnique({
      where: { id },
      include: { job: true },
    });

    if (!app) throw new Error("Application record not found.");
    return { success: true, data: app };
  }

  /**
   * Admin: Update Career Application (status, rating, recruiter, notes)
   */
  async updateCareerApplication(
    id: string,
    updates: {
      status?: string;
      rating?: number;
      assignedRecruiterId?: string;
      assignedRecruiter?: string;
      internalNotes?: string;
    }
  ) {
    const dataToUpdate: any = {};

    if (updates.status) dataToUpdate.status = updates.status;
    if (updates.rating !== undefined) dataToUpdate.rating = Number(updates.rating);
    if (updates.assignedRecruiterId !== undefined) dataToUpdate.assignedRecruiterId = updates.assignedRecruiterId;
    if (updates.assignedRecruiter !== undefined) dataToUpdate.assignedRecruiter = updates.assignedRecruiter;
    if (updates.internalNotes !== undefined) dataToUpdate.internalNotes = updates.internalNotes;

    const updated = await prisma.careerApplication.update({
      where: { id },
      data: dataToUpdate,
    });

    return { success: true, data: updated };
  }
}

export const careersCmsService = new CareersCmsService();
