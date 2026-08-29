import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const titles = ["Build E-Commerce App", "Develop API Service", "Create SaaS Platform", "Create Dashboard"];
  for (const title of titles) {
    const projects = await prisma.project.findMany({ where: { title } });
    if (projects.length > 1) {
      // Find one that has a proposal by Alex Joshi
      const user = await prisma.user.findFirst({ where: { fullName: "Alex Joshi" } });
      const proposals = await prisma.proposal.findMany({
        where: { projectId: { in: projects.map(p => p.id) }, freelancerId: user?.id }
      });
      
      const appliedProjectIds = proposals.map(p => p.projectId);
      
      for (const p of projects) {
        if (!appliedProjectIds.includes(p.id)) {
          // Delete it so it doesn't confuse the user
          await prisma.proposal.deleteMany({ where: { projectId: p.id } });
          await prisma.project.delete({ where: { id: p.id } });
          console.log(`Deleted duplicate project: ${p.title} (${p.id})`);
        }
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
