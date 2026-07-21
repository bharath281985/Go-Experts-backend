import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting bulk wallet credit and notification script...");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true },
  });

  console.log(`Found ${users.length} total users in database.`);

  let count = 0;
  for (const user of users) {
    try {
      // 1. Ensure wallet exists and credit 500
      let wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: { userId: user.id, balance: 0, currency: "INR" },
        });
      }

      const updatedWallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: 500 } },
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "Credit",
          amount: 500,
          direction: "credit",
          description: "₹500 promotional wallet credit added by Super Admin",
          balanceAfter: updatedWallet.balance,
        },
      });

      // 2. Notification 1: Test notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          role: user.role,
          type: "system",
          title: "System Verification Alert",
          message: "Test Notification: Your account notifications and real-time alerts are fully active.",
          channel: "in_app",
          priority: "normal",
        },
      });

      // 3. Notification 2: Wallet Credited notification
      await prisma.notification.create({
        data: {
          userId: user.id,
          role: user.role,
          type: "wallet",
          title: "Wallet Credited",
          message: "₹500 has been credited to your wallet balance by Super Admin.",
          channel: "in_app",
          priority: "high",
        },
      });

      count++;
      console.log(`[SUCCESS] User: ${user.fullName || user.email} (${user.id}) | Wallet Balance: ${updatedWallet.balance}`);
    } catch (err) {
      console.error(`[ERROR] User: ${user.id}`, err);
    }
  }

  console.log(`\nCOMPLETED: Credited ₹500 and sent 2 notifications to ${count} / ${users.length} users.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
