const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fixAmounts() {
  const referrals = await prisma.referral.findMany({ where: { status: 'completed', rewardAmount: null } });
  for (const referral of referrals) {
    const amount = 25; // Default amount I used in the previous fix script
    await prisma.referral.update({ where: { id: referral.id }, data: { rewardAmount: amount } });
    console.log('Fixed rewardAmount for referral:', referral.id);
  }
  console.log('All done!');
  process.exit(0);
}
fixAmounts().catch(console.error);
