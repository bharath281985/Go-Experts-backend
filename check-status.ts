import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { title: "Build API Service" },
    include: { proposals: true }
  });
  
  projects.forEach(p => {
    console.log(`Project: ${p.title} (ID: ${p.id})`);
    console.log(`Status: ${p.status}`);
    const accepted = p.proposals.filter(prop => prop.status.toLowerCase() === 'accepted');
    console.log(`Accepted Proposals: ${accepted.length}`);
  });
}
main().finally(() => prisma.$disconnect());
