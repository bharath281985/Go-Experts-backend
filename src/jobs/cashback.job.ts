import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { sendCashbackEmail } from "../services/mobile/email.service.js";

const prisma = new PrismaClient();

// Run every day at 00:00 (Midnight)
export const initCashbackJob = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("[CASHBACK JOB] Starting daily cashback processing...");
    
    try {
      const now = new Date();
      // We process active subscriptions
      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: "active",
        },
        include: {
          user: true,
          plan: true,
        },
      });

      let processedCount = 0;

      for (const sub of subscriptions) {
        // Find how many months have passed since the start date
        const monthsSinceStart = Math.floor(
          (now.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        // Calculate the plan term based on endDate - startDate (roughly)
        const totalTermMonths = Math.round(
          (sub.endDate.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );

        // Check if we owe them a cashback this month
        // We owe a cashback if: 
        // 1. monthsSinceStart > cashbackMonthsPaid (meaning they entered a new month)
        // 2. cashbackMonthsPaid < totalTermMonths (meaning we haven't paid out all months of the term)
        if (monthsSinceStart > sub.cashbackMonthsPaid && sub.cashbackMonthsPaid < totalTermMonths) {
          // Calculate 5% of the plan cost
          // We'll use the plan's price for calculation
          const planPrice = sub.plan.amount || 0;
          if (planPrice <= 0) continue; // Free plan, no cashback

          const cashbackAmount = parseFloat((planPrice * 0.05).toFixed(2));

          // Use transaction to ensure consistency
          await prisma.$transaction(async (tx) => {
            // Find or create wallet
            let wallet = await tx.wallet.findFirst({ where: { userId: sub.userId } });
            if (!wallet) {
              wallet = await tx.wallet.create({ data: { userId: sub.userId, balance: 0, currency: "INR" } });
            }

            // Update wallet balance
            const updatedWallet = await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: cashbackAmount } },
            });

            // Create wallet transaction
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: "Cashback",
                direction: "credit",
                amount: cashbackAmount,
                description: `5% Monthly Cashback for ${sub.plan.name} Plan`,
                balanceAfter: updatedWallet.balance,
              },
            });

            // Update subscription tracking
            await tx.subscription.update({
              where: { id: sub.id },
              data: {
                cashbackMonthsPaid: { increment: 1 },
                lastCashbackDate: new Date(),
              },
            });
          });

          // Send email
          if (sub.user.email) {
            await sendCashbackEmail(
              sub.user.email,
              sub.user.fullName || "User",
              cashbackAmount,
              sub.plan.name
            );
          }

          processedCount++;
        }
      }

      console.log(`[CASHBACK JOB] Finished processing. Distributed cashback to ${processedCount} users.`);
    } catch (error) {
      console.error("[CASHBACK JOB] Error processing cashbacks:", error);
    }
  });

  console.log("[CASHBACK JOB] Scheduled to run every day at midnight.");
};
