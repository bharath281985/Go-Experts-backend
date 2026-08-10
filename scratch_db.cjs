const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.setting.findMany()
  .then(settings => {
    console.log(JSON.stringify(settings, null, 2));
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect());
