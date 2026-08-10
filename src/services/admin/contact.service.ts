import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ContactPageContent {
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
  contactInfo: {
    generalEmail: string;
    supportEmail: string;
    careersEmail: string;
    businessEmail: string;
    phone: string;
    secondaryPhone?: string;
    whatsappNumber?: string;
    tollFreeNumber?: string;
    mainAddress: string;
    registeredAddress?: string;
    websiteUrl: string;
  };
  supportChannels: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    contactEmail: string;
    phone?: string;
    ctaLabel: string;
    ctaUrl: string;
    order: number;
    enabled: boolean;
  }>;
  formConfig: {
    heading: string;
    description: string;
    successMessage: string;
    consentText: string;
    privacyUrl: string;
    recipientEmail: string;
    enabled: boolean;
  };
  officeLocations: Array<{
    id: string;
    officeName: string;
    city: string;
    address: string;
    phone: string;
    email: string;
    order: number;
    enabled: boolean;
  }>;
  workingHours: {
    mondayToFriday: string;
    saturday: string;
    sunday: string;
    timezone: string;
  };
  socialLinks: Array<{
    platform: string;
    url: string;
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

const PAGE_NAME = "Contact";
const PAGE_CATEGORY = "Company";

function generateContactReference(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `GE-CON-${dateStr}-${randomNum}`;
}

export class ContactCmsService {
  /**
   * Ensure Contact CMS page record exists in database
   */
  private async getOrCreatePage() {
    let page = await prisma.cmsPage.findFirst({
      where: {
        OR: [
          { name: { equals: "Contact" } },
          { name: { equals: "Contact Us" } },
        ],
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!page) {
      const initialPayload: ContactPageContent = {
        hero: {
          eyebrow: "Let's Talk",
          heading: "Need Help or Want to Discuss a Project?",
          highlightText: "Discuss a Project?",
          description: "Our dedicated team is available 24/7 to assist with platform questions, enterprise partnerships, or technical support.",
          image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80",
          imageAlt: "Customer Support Representative",
          primaryCtaLabel: "Send Message",
          primaryCtaUrl: "#contact-form",
          secondaryCtaLabel: "Explore FAQs",
          secondaryCtaUrl: "#contact-faq",
          enabled: true,
        },
        contactInfo: {
          generalEmail: "hello@goexperts.in",
          supportEmail: "support@goexperts.in",
          careersEmail: "careers@goexperts.in",
          businessEmail: "enterprise@goexperts.in",
          phone: "+91 80 4567 8900",
          secondaryPhone: "+91 80 4567 8901",
          whatsappNumber: "+91 98765 43210",
          tollFreeNumber: "1800 123 4567",
          mainAddress: "Go Experts Tower, 100 Feet Road, Indiranagar, Bengaluru, KA 560038, India",
          registeredAddress: "Go Experts Inc., 500 Howard Street, Suite 400, San Francisco, CA 94105, USA",
          websiteUrl: "https://goexperts.in",
        },
        supportChannels: [
          { id: "supp-1", icon: "HelpCircle", title: "Customer Support", description: "Get assistance with your account, payments, or ongoing projects.", contactEmail: "support@goexperts.in", ctaLabel: "Email Support", ctaUrl: "mailto:support@goexperts.in", order: 1, enabled: true },
          { id: "supp-2", icon: "Building2", title: "Enterprise & Sales", description: "Learn about custom contracts, volume pricing, and dedicated account management.", contactEmail: "enterprise@goexperts.in", ctaLabel: "Contact Sales", ctaUrl: "mailto:enterprise@goexperts.in", order: 2, enabled: true },
          { id: "supp-3", icon: "Briefcase", title: "Careers & Talent", description: "Interested in joining our team? Reach out directly to our talent acquisition team.", contactEmail: "careers@goexperts.in", ctaLabel: "View Openings", ctaUrl: "/careers", order: 3, enabled: true },
        ],
        formConfig: {
          heading: "Send Us a Message",
          description: "Fill out the form below and our team will get back to you within 24 hours.",
          successMessage: "Thank you! Your enquiry has been received. Reference number: ",
          consentText: "I agree to the Go Experts Privacy Policy and Terms of Service.",
          privacyUrl: "/privacy",
          recipientEmail: "contact-submissions@goexperts.in",
          enabled: true,
        },
        officeLocations: [
          { id: "loc-1", officeName: "Bengaluru HQ", city: "Bengaluru, India", address: "100 Feet Road, Indiranagar, Bengaluru 560038", phone: "+91 80 4567 8900", email: "india@goexperts.in", order: 1, enabled: true },
          { id: "loc-2", officeName: "San Francisco Office", city: "San Francisco, USA", address: "500 Howard St, Suite 400, San Francisco, CA 94105", phone: "+1 415 555 0199", email: "us@goexperts.in", order: 2, enabled: true },
          { id: "loc-3", officeName: "Singapore Hub", city: "Singapore", address: "Marina Bay Financial Centre, Tower 1, Singapore 018981", phone: "+65 6789 0123", email: "sg@goexperts.in", order: 3, enabled: true },
        ],
        workingHours: {
          mondayToFriday: "9:00 AM – 6:00 PM",
          saturday: "10:00 AM – 4:00 PM",
          sunday: "Closed",
          timezone: "IST / UTC+5:30",
        },
        socialLinks: [
          { platform: "LinkedIn", url: "https://linkedin.com/company/goexperts" },
          { platform: "Twitter", url: "https://twitter.com/goexperts" },
          { platform: "GitHub", url: "https://github.com/goexperts" },
        ],
        faqs: [
          { id: "faq-1", question: "What are your support operating hours?", answer: "Our customer support team is available Monday through Saturday. For urgent enterprise issues, 24/7 emergency support is provided to contracted clients.", order: 1 },
          { id: "faq-2", question: "How fast do you respond to enquiries?", answer: "We aim to respond to all general enquiries within 24 hours. Priority support ticket SLA is under 2 hours.", order: 2 },
          { id: "faq-3", question: "Where is Go Experts headquartered?", answer: "Go Experts is headquartered in Bengaluru, India with global operations in San Francisco and Singapore.", order: 3 },
        ],
        seo: {
          metaTitle: "Contact Us — Go Experts Enterprise Platform",
          metaDescription: "Get in touch with Go Experts for support, enterprise sales, partnerships, or career inquiries.",
          canonicalUrl: "https://goexperts.in/contact",
          ogTitle: "Contact Go Experts Team",
          ogDescription: "We are here to help. Reach out to our global team today.",
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

      await prisma.cmsPageRevision.create({
        data: {
          pageId: page.id,
          version: 1,
          contentJson: payloadStr,
          status: "published",
          createdBy: "System",
          changeSummary: "Initial Contact Page created",
        },
      });
    }

    return page;
  }

  /**
   * Public: Get Contact Page Payload
   */
  async getPublicContactPage() {
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
   * Admin: Get Contact CMS Page for editing
   */
  async getAdminContactPage() {
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
   * Admin: Save Draft Contact Page
   */
  async saveContactDraft(payload: any) {
    const page = await this.getOrCreatePage();
    const str = JSON.stringify(payload);

    const updated = await prisma.cmsPage.update({
      where: { id: page.id },
      data: {
        draftJson: str,
        updated: new Date().toISOString().slice(0, 10),
      },
    });

    return { success: true, pageId: updated.id, version: updated.version };
  }

  /**
   * Admin: Publish Contact Page
   */
  async publishContactPage(payload: any, adminName: string = "Admin") {
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

    await prisma.cmsPageRevision.create({
      data: {
        pageId: page.id,
        version: newVersion,
        contentJson: str,
        status: "published",
        createdBy: adminName,
        changeSummary: `Published version ${newVersion}`,
      },
    });

    return { success: true, pageId: updated.id, version: newVersion };
  }

  /**
   * Public: Submit Contact Enquiry
   */
  async submitPublicEnquiry(input: {
    fullName: string;
    email: string;
    phone?: string;
    company?: string;
    enquiryType: string;
    subject: string;
    message: string;
    preferredContactMethod?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    if (!input.fullName || !input.email || !input.subject || !input.message) {
      throw new Error("Full name, email, subject, and message are required fields.");
    }

    const referenceNumber = generateContactReference();

    const enquiry = await prisma.contactEnquiry.create({
      data: {
        referenceNumber,
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        company: input.company?.trim() || null,
        enquiryType: input.enquiryType || "General Enquiry",
        subject: input.subject.trim(),
        message: input.message.trim(),
        preferredContactMethod: input.preferredContactMethod || "Email",
        status: "new",
        priority: "normal",
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });

    return {
      success: true,
      referenceNumber: enquiry.referenceNumber,
      message: `Enquiry submitted successfully. Your reference code is ${enquiry.referenceNumber}.`,
    };
  }

  /**
   * Admin: List Contact Enquiries with pagination & filters
   */
  async listContactEnquiries(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    enquiryType?: string;
    priority?: string;
  }) {
    const page = Number(params.page || 1);
    const pageSize = Number(params.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const where: any = { deletedAt: null };

    if (params.status && params.status !== "all") {
      where.status = params.status;
    }
    if (params.enquiryType && params.enquiryType !== "all") {
      where.enquiryType = params.enquiryType;
    }
    if (params.priority && params.priority !== "all") {
      where.priority = params.priority;
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { referenceNumber: { contains: q } },
        { fullName: { contains: q } },
        { email: { contains: q } },
        { subject: { contains: q } },
        { company: { contains: q } },
      ];
    }

    const [total, rows, newCount, openCount, inProgressCount, resolvedCount] = await Promise.all([
      prisma.contactEnquiry.count({ where }),
      prisma.contactEnquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.contactEnquiry.count({ where: { deletedAt: null, status: "new" } }),
      prisma.contactEnquiry.count({ where: { deletedAt: null, status: "open" } }),
      prisma.contactEnquiry.count({ where: { deletedAt: null, status: "in_progress" } }),
      prisma.contactEnquiry.count({ where: { deletedAt: null, status: "resolved" } }),
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
        open: openCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
      },
    };
  }

  /**
   * Admin: Get Single Contact Enquiry Detail
   */
  async getContactEnquiryById(id: string) {
    const enquiry = await prisma.contactEnquiry.findUnique({
      where: { id },
    });

    if (!enquiry) {
      throw new Error("Contact enquiry not found.");
    }

    return { success: true, data: enquiry };
  }

  /**
   * Admin: Update Contact Enquiry (status, priority, assigned admin, internal notes)
   */
  async updateContactEnquiry(
    id: string,
    updates: {
      status?: string;
      priority?: string;
      assignedAdminId?: string;
      assignedAdminName?: string;
      internalNotes?: string;
    }
  ) {
    const dataToUpdate: any = {};

    if (updates.status) {
      dataToUpdate.status = updates.status;
      if (updates.status === "resolved" || updates.status === "closed") {
        dataToUpdate.resolvedAt = new Date();
      }
    }

    if (updates.priority) dataToUpdate.priority = updates.priority;
    if (updates.assignedAdminId !== undefined) dataToUpdate.assignedAdminId = updates.assignedAdminId;
    if (updates.assignedAdminName !== undefined) dataToUpdate.assignedAdminName = updates.assignedAdminName;
    if (updates.internalNotes !== undefined) dataToUpdate.internalNotes = updates.internalNotes;

    const updated = await prisma.contactEnquiry.update({
      where: { id },
      data: dataToUpdate,
    });

    return { success: true, data: updated };
  }
}

export const contactCmsService = new ContactCmsService();
