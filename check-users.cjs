const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    where: { role: 'client' },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });
  console.log('Recent Client Users:');
  users.forEach(u => console.log(u.email, u.fullName, u.id));
}

checkUsers().catch(console.error).finally(() => prisma.$disconnect());
