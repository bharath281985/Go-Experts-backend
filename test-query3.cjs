const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mo = await prisma.masterOption.findUnique({where: {id: '7344b40a-950c-4e65-894c-5f9582389b85'}});
  console.log('MasterOption:', mo);
  const totalMo = await prisma.masterOption.count();
  console.log('Total MasterOptions:', totalMo);
  
  const tags = await prisma.masterOption.findMany({where: { type: 'skill' }});
  console.log('Skills in MasterOption:', tags.length);
}

main().finally(() => prisma.$disconnect());
