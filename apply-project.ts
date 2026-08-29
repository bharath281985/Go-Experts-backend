import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { fullName: "Alex Joshi" } });
  const project = await prisma.project.findFirst({ where: { title: "Develop SaaS Platform" } });
  
  if (user && project) {
    // create a proposal for develop saas platform
    await prisma.proposal.create({
      data: {
        projectId: project.id,
        freelancerId: user.id,
        bidAmount: 10000,
        status: 'SUBMITTED'
      }
    });
    console.log("Successfully created proposal for Develop SaaS Platform for Alex Joshi!");
  } else {
    console.log("Could not find user or project.");
  }
}
main().finally(() => prisma.$disconnect());
