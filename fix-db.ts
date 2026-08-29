import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany();
  const users = await prisma.user.findMany({ where: { role: 'client' } });
  let updated = 0;
  for (const project of projects) {
    const clientUser = users.find(u => u.fullName === project.client);
    if (clientUser) {
      await prisma.project.update({
        where: { id: project.id },
        data: { client: clientUser.id }
      });
      updated++;
    }
  }
  console.log(`Updated ${updated} projects`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
