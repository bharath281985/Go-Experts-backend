import { PrismaClient } from "@prisma/client";
import { RESUME_RENDERERS } from "../constants/resume-renderers.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding resume templates...");

  const templatesToSeed = [
    {
      key: "professional",
      name: "Professional",
      category: "PROFESSIONAL",
      description: "Clean enterprise-focused resume layout with standard section styling.",
      rendererKey: "professional",
      sortOrder: 1,
      atsFriendly: true
    },
    {
      key: "modern",
      name: "Modern",
      category: "MODERN",
      description: "A contemporary design with subtle accent colors and icons.",
      rendererKey: "modern",
      sortOrder: 2,
      atsFriendly: true
    },
    {
      key: "ats-optimized",
      name: "ATS Optimized",
      category: "ATS",
      description: "Strictly text-based, bare-bones layout guaranteed to parse correctly in all applicant tracking systems.",
      rendererKey: "ats",
      sortOrder: 3,
      atsFriendly: true
    },
    {
      key: "creative",
      name: "Creative",
      category: "CREATIVE",
      description: "Stand out with a unique layout featuring strong typography and distinct color blocks.",
      rendererKey: "creative",
      sortOrder: 4,
      atsFriendly: false
    },
    {
      key: "developer",
      name: "Developer",
      category: "TECHNOLOGY",
      description: "Geared towards software engineers with a focus on technical skills and projects.",
      rendererKey: "developer",
      sortOrder: 5,
      atsFriendly: true
    }
  ];

  for (const t of templatesToSeed) {
    const rendererConfig = RESUME_RENDERERS[t.rendererKey];
    if (!rendererConfig) {
      console.warn(`Renderer ${t.rendererKey} not found for template ${t.key}. Skipping.`);
      continue;
    }

    // Upsert Template
    const template = await prisma.resumeTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        category: t.category,
        description: t.description,
        sortOrder: t.sortOrder,
        status: "published"
      },
      create: {
        key: t.key,
        name: t.name,
        category: t.category,
        description: t.description,
        sortOrder: t.sortOrder,
        status: "published",
        currentVersion: 1
      }
    });

    // Upsert Template Version 1
    await prisma.resumeTemplateVersion.upsert({
      where: {
        templateId_version: {
          templateId: template.id,
          version: 1
        }
      },
      update: {
        rendererKey: t.rendererKey,
        supportedSections: JSON.stringify(rendererConfig.supportedSections),
        atsFriendly: t.atsFriendly,
        publishedAt: new Date()
      },
      create: {
        templateId: template.id,
        version: 1,
        rendererKey: t.rendererKey,
        supportedSections: JSON.stringify(rendererConfig.supportedSections),
        atsFriendly: t.atsFriendly,
        publishedAt: new Date()
      }
    });

    console.log(`Seeded template: ${t.key}`);
  }

  console.log("Resume template seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
