import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  try {
    const vinod = await prisma.user.findFirst({ where: { email: 'vk4950362@gmail.com' } });
    if (!vinod) return console.log('Vinod not found');

    const referral = await prisma.referral.findUnique({
      where: { refereeId: vinod.id },
      include: { referrer: true, referee: true },
    });

    if (!referral) return console.log('Referral not found for Vinod');

    const cashbackAmount = 25.00; // Mock 5% of 500
    
    let referrerWallet = await prisma.wallet.findUnique({ where: { userId: referral.referrer.id } });
    if (!referrerWallet) {
      referrerWallet = await prisma.wallet.create({
        data: { userId: referral.referrer.id, balance: 0 },
      });
    }

    const newBalance = Number(referrerWallet.balance) + cashbackAmount;

    const updatedWallet = await prisma.wallet.update({
      where: { id: referrerWallet.id },
      data: { balance: newBalance },
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: updatedWallet.id,
        type: 'referral_cashback',
        amount: cashbackAmount,
        direction: 'credit',
        description: '5% Cashback for referral subscription purchase by vinod',
        balanceAfter: newBalance,
        status: 'completed',
      },
    });

    await prisma.referralReward.create({
      data: {
        referralId: referral.id,
        amount: cashbackAmount,
        points: 0,
      }
    });

    console.log('Successfully added manual cashback for Vinod to Sai');
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
run();
