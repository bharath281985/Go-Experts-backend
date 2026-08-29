const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const p = await prisma.proposal.findMany({ 
    where: { projectId: '30bb181e-bf40-4ccb-8db9-f2e0e527f433' } 
  }); 
  console.log(JSON.stringify(p, null, 2)); 
} 
main().finally(() => prisma.$disconnect());
