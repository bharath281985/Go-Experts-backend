import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const proposals = await prisma.proposal.findMany({
    include: { project: true, freelancer: true }
  });
  console.log(`Total proposals in DB: ${proposals.length}`);
  proposals.forEach(p => {
    console.log(`- Project: ${p.project?.title}, Freelancer: ${p.freelancer?.fullName}, Status: ${p.status}`);
  });
}
main().finally(() => prisma.$disconnect());
