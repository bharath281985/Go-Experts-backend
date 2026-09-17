import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const ideas = await prisma.startupIdea.findMany({ take: 5 });
  console.log('--- Startup Ideas ---');
  console.log(ideas);
  
  // Try to find if there are stages in Master
  const stages = await prisma.master.findMany({
    where: { group: { contains: 'stage' } }
  });
  console.log('\n--- Stages in Master ---');
  console.log(stages);
  
  // Check the DB schema for Master groups to see all available categories
  const groups = await prisma.master.findMany({
    select: { group: true },
    distinct: ['group']
  });
  console.log('\n--- Master Groups ---');
  console.log(groups);
}

check().catch(console.error).finally(() => prisma.$disconnect());
