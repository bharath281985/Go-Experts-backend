import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const pages = await prisma.cmsPage.findMany({ select: { name: true } });
  console.log(pages);
}
run().catch(console.error).finally(() => {
  const p = prisma as any;
  p.$disconnect();
});
