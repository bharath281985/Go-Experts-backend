import { prisma } from './config/database.js';

async function inspect() {
  const industries = await prisma.industry.findMany().catch(() => []);
  console.log("INDUSTRIES:", JSON.stringify(industries, null, 2));

  const categories = await prisma.skillCategory.findMany().catch(() => []);
  console.log("CATEGORIES:", JSON.stringify(categories, null, 2));

  const skills = await prisma.skill.findMany({ take: 20 }).catch(() => []);
  console.log("SKILLS SAMPLE:", JSON.stringify(skills, null, 2));
}

inspect().finally(() => (prisma as any).$disconnect());
