import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const stages = await prisma.startupIdea.findMany({ select: { stage: true }, distinct: ['stage'] });
  console.log('--- Unique Stages in DB ---');
  console.log(stages.map(s => s.stage));

  const founders = await prisma.startupIdea.findMany({ select: { founder: true }, distinct: ['founder'] });
  console.log('\n--- Unique Founders in DB ---');
  console.log(founders.map(f => f.founder));
}

check().catch(console.error).finally(() => prisma.$disconnect());
