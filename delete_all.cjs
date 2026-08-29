const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  await prisma.proposal.deleteMany({ 
    where: { projectId: '30bb181e-bf40-4ccb-8db9-f2e0e527f433' } 
  }); 
  console.log('Deleted all orphaned proposals for the project'); 
} 
main().finally(() => prisma.$disconnect());
