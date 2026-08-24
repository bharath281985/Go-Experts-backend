const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.update({
    where: { email: 'vinod.goexperts@gmail.com' },
    data: { deletedAt: null }
  });
  console.log("Updated user:", user.email, "deletedAt:", user.deletedAt);
}
main().finally(() => prisma.$disconnect());
