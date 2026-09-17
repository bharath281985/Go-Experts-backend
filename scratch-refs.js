import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  try {
    const refs = await prisma.referral.findMany({ include: { referee: true, referrer: true } });
    console.log('Referrals:');
    refs.forEach(r => console.log(r.id, 'referrer:', r.referrer?.email, r.referrer?.fullName, 'referee:', r.referee?.email, r.referee?.fullName));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
