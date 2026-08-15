import { prisma } from "../src/config/database.js";

async function cleanup() {
  // Find all unverified users who have a 0 amount / 90_days subscription
  const unverifiedFreeSubs = await prisma.subscription.findMany({
    where: {
      user: {
        OR: [
          { isVerified: false },
          { status: "pending" }
        ]
      },
      plan: {
        OR: [
          { amount: 0 },
          { duration: "90_days" }
        ]
      }
    },
    include: { user: true, plan: true }
  });

  console.log(`Found ${unverifiedFreeSubs.length} free subscriptions on unverified users:`);
  for (const s of unverifiedFreeSubs) {
    console.log(`- Sub ${s.id} for user ${s.user.fullName} (${s.user.email}) - isVerified: ${s.user.isVerified}, status: ${s.user.status}`);
  }

  if (unverifiedFreeSubs.length > 0) {
    const deleted = await prisma.subscription.deleteMany({
      where: {
        id: { in: unverifiedFreeSubs.map(s => s.id) }
      }
    });
    console.log(`Cleaned up ${deleted.count} stray free subscriptions from unverified users.`);
  }
}

cleanup().finally(() => prisma.$disconnect());
