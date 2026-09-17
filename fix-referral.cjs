const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function fixAll() {
  const referrals = await prisma.referral.findMany({ where: { status: 'pending' }, include: { referee: true, referrer: true } });
  for (const referral of referrals) {
    const amount = 25;
    await prisma.$transaction(async (tx) => {
      await tx.referral.update({ where: { id: referral.id }, data: { status: 'completed' } });
      await tx.referralReward.create({ data: { referralId: referral.id, amount, status: 'paid' } }).catch(() => null);
      let wallet = await tx.wallet.findUnique({ where: { userId: referral.referrerId } });
      if (!wallet) { wallet = await tx.wallet.create({ data: { userId: referral.referrerId, balance: 0, currency: 'INR' } }); }
      const updatedWallet = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
      await tx.walletTransaction.create({ data: { walletId: wallet.id, type: 'referral_bonus', direction: 'credit', amount, description: 'Referral Bonus for ' + referral.referee.fullName, balanceAfter: updatedWallet.balance } });
    });
    console.log('Fixed:', referral.referee.email);
  }
  process.exit(0);
}
fixAll().catch(console.error);
