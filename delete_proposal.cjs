const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  await prisma.proposal.deleteMany({ 
    where: { 
      projectId: '30bb181e-bf40-4ccb-8db9-f2e0e527f433', 
      freelancerId: 'e0fc51ee-2068-47ce-933c-be61b6b5c326' 
    } 
  }); 
  console.log('Deleted orphaned proposal'); 
} 
main().finally(() => prisma.$disconnect());
