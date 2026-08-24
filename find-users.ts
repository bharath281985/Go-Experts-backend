import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const client = await prisma.user.findFirst({
    where: { role: 'client', projects: { some: {} } },
    include: { projects: true }
  });
  const freelancer = await prisma.user.findFirst({
    where: { role: 'freelancer' }
  });
  console.log('Client Email:', client?.email);
  console.log('Freelancer Email:', freelancer?.email);
}
main().catch(console.error).finally(() => prisma.\$disconnect\());
