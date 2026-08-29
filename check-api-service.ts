import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { title: "Build API Service" }
  });
  console.log(`Found ${projects.length} projects with title "Build API Service"`);
}
main().finally(() => prisma.$disconnect());
