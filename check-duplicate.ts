import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { title: "Build E-Commerce App" }
  });
  console.log(`Found ${projects.length} projects with title "Build E-Commerce App"`);
  projects.forEach(p => console.log(`- ID: ${p.id}, Client: ${p.client}`));
}
main().finally(() => prisma.$disconnect());
