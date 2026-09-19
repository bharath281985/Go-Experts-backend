import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getHowItWorksPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cmsSections = await prisma.cmsHowItWorks.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
    });

    const workflowSteps = await prisma.workflowStep.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
    });

    // Handle string case differences for status based on schema defaults
    const testimonials = await prisma.testimonial.findMany({
      where: { 
        status: { in: ["PUBLISHED", "published", "active", "ACTIVE"] }, 
        pageKey: "how-it-works"
      },
      orderBy: { createdAt: "desc" },
    });

    const faqs = await prisma.faq.findMany({
      where: { 
        status: { in: ["PUBLISHED", "published", "active", "ACTIVE"] }, 
        pageKey: "how-it-works"
      },
      orderBy: { sortOrder: "asc" },
    });

    // Structure response
    const response = {
      hero: {
        general: {},
        freelancer: {},
        client: {},
        founder: {},
        investor: {}
      },
      roles: [] as any[],
      workflows: {
        freelancer: [] as any[],
        client: [] as any[],
        founder: [] as any[],
        investor: [] as any[]
      },
      features: [] as any[],
      statistics: [] as any[],
      dashboardPreviews: [] as any[],
      cta: {
        general: {},
        freelancer: {},
        client: {},
        founder: {},
        investor: {}
      },
      testimonials,
      faqs,
    };

    // Map Workflows (icon field stores the outcome text)
    workflowSteps.forEach(step => {
      const key = step.roleType as keyof typeof response.workflows;
      if (response.workflows[key]) {
        response.workflows[key].push({
          id: step.id,
          title: step.title,
          description: step.description,
          sortOrder: step.sortOrder,
          contentJson: { outcome: step.icon ?? "" },
        });
      }
    });

    // Map CMS Sections
    cmsSections.forEach(section => {
      if (section.sectionName === "hero") {
         if (section.roleType && response.hero[section.roleType as keyof typeof response.hero]) {
            response.hero[section.roleType as keyof typeof response.hero] = {
               title: section.title,
               subtitle: section.subtitle,
               description: section.description,
               buttonText: section.buttonText,
               buttonLink: section.buttonLink,
               icon: section.icon,
               image: section.image
            };
         }
      } else if (section.sectionName === "roles") {
         response.roles = section.contentJson ? (section.contentJson as any) : [];
      } else if (section.sectionName === "features") {
         response.features = section.contentJson ? (section.contentJson as any) : [];
      } else if (section.sectionName === "statistics") {
         response.statistics = section.contentJson ? (section.contentJson as any) : [];
      } else if (section.sectionName === "dashboard_previews") {
         response.dashboardPreviews = section.contentJson ? (section.contentJson as any) : [];
      } else if (section.sectionName === "cta") {
         if (section.roleType && response.cta[section.roleType as keyof typeof response.cta]) {
            response.cta[section.roleType as keyof typeof response.cta] = {
               title: section.title,
               description: section.description,
               buttonText: section.buttonText,
               buttonLink: section.buttonLink,
            };
         }
      }
    });

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
};
