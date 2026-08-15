import { prisma } from "../src/config/database.js";

async function inspect() {
  const user = await prisma.user.findFirst({
    where: {
      fullName: { contains: "Sneha" }
    },
    include: {
      subscriptions: {
        include: { plan: true }
      }
    }
  });

  console.log("SNEHA USER:", {
    id: user?.id,
    fullName: user?.fullName,
    email: user?.email,
    status: user?.status,
    isVerified: user?.isVerified,
    verified: user?.verified,
    trialEndsAt: user?.trialEndsAt,
    subscriptionsCount: user?.subscriptions?.length,
    subscriptions: user?.subscriptions
  });
}

inspect().finally(() => prisma.$disconnect());
