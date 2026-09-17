import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  try {
    const allRefs = await prisma.referral.findMany({
      include: { referrer: { select: { email: true } }, referee: { select: { email: true } } }
    });
    console.log('All referrals:', JSON.stringify(allRefs, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}
run();
