const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const m = await prisma.message.findMany({ take: 5, orderBy: { createdAt: 'desc' } }); 
  console.log(m); 
} 
main().finally(() => prisma.$disconnect());
