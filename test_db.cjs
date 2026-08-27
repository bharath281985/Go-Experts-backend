const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
prisma.user.findUnique({ where: { id: '03445a6b-80b3-4a68-80bc-d844d95af9d2' } })
  .then(console.log)
  .finally(() => prisma.$disconnect());
