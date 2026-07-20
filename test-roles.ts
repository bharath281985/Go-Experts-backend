import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { role: true } });
  const roles = [...new Set(users.map(u => u.role))];
  console.log("Roles in DB:", roles);
}

main().catch(console.error).finally(() => prisma.$disconnect());
