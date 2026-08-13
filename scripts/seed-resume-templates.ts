import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const templates = [
    {
      key: "tech-minimalist-1",
      name: "Tech Minimalist",
      category: "Software Development",
      description: "A clean, modern layout ideal for Software Engineers and Data Scientists.",
      status: "published",
    },
    {
      key: "design-creative-1",
      name: "Creative Portfolio",
      category: "Design & Creative",
      description: "A visually striking template that highlights portfolios and projects.",
      status: "published",
    },
    {
      key: "finance-exec-1",
      name: "Finance Executive",
      category: "Finance & Accounting",
      description: "A traditional, structured layout preferred by banks and financial institutions.",
      status: "published",
    },
    {
      key: "healthcare-pro-1",
      name: "Healthcare Professional",
      category: "Healthcare",
      description: "Clear and concise format for medical professionals highlighting certifications.",
      status: "published",
    },
    {
      key: "sales-marketing-1",
      name: "Marketing Strategist",
      category: "Sales & Marketing",
      description: "Dynamic layout focusing on KPIs, metrics, and campaign success.",
      status: "published",
    },
    {
      key: "legal-formal-1",
      name: "Legal Formal",
      category: "Legal",
      description: "A highly formal, text-focused template suitable for law firms and attorneys.",
      status: "published",
    },
    {
      key: "education-academic-1",
      name: "Academic CV",
      category: "Education",
      description: "An extended format designed for teachers, researchers, and academics.",
      status: "published",
    },
    {
      key: "engineering-arch-1",
      name: "Engineering & Architecture",
      category: "Engineering",
      description: "Structured design that clearly maps out technical projects and skills.",
      status: "published",
    },
    {
      key: "consulting-standard-1",
      name: "Consulting Standard",
      category: "Consulting",
      description: "The standard management consulting template, optimized for ATS.",
      status: "published",
    },
    {
      key: "operations-supply-1",
      name: "Operations & Supply Chain",
      category: "Operations",
      description: "Process-oriented layout highlighting logistics and operational efficiency.",
      status: "published",
    },
  ];

  for (const t of templates) {
    const template = await prisma.resumeTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        category: t.category,
        description: t.description,
        status: t.status,
      },
      create: {
        key: t.key,
        name: t.name,
        category: t.category,
        description: t.description,
        status: t.status,
        currentVersion: 1,
      },
    });

    await prisma.resumeTemplateVersion.upsert({
      where: {
        templateId_version: {
          templateId: template.id,
          version: 1,
        },
      },
      update: {},
      create: {
        templateId: template.id,
        version: 1,
        rendererKey: "professional", // Using the default professional renderer
        atsFriendly: true,
        supportedSections: ["PROFILE", "EXPERIENCE", "EDUCATION", "SKILLS"],
      },
    });
    console.log(`Upserted template: ${t.name} (${t.category})`);
  }

  console.log("Seeding 10 Resume Templates Completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
