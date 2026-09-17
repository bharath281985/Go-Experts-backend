import { PrismaClient } from '@prisma/client';
import fs from 'fs';
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
    
    const totalDebited = cashbackTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    
    const result = {
      success: true,
      data: {
        totalDebited: parseFloat(totalDebited.toFixed(2)),
        count: cashbackTxns.length,
        transactions: cashbackTxns.map(t => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt,
          user: t.wallet?.user
        }))
      }
    };
    
    fs.writeFileSync('cashback-test-output.json', JSON.stringify(result, null, 2));
    console.log('Wrote to cashback-test-output.json');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
