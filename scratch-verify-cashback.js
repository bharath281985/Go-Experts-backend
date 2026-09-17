import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  try {
    const cashbackTxns = await prisma.walletTransaction.findMany({
      where: { type: 'referral_cashback' },
      include: {
        wallet: {
          include: {
            user: { select: { id: true, fullName: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    console.log('Result length:', cashbackTxns.length);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
