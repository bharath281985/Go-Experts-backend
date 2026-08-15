import { prisma } from "../src/config/database.js";

async function inspect() {
  const sub = await prisma.subscription.findUnique({
    where: { id: "95f0d4b6-9c30-4006-b3da-9bb0040693b8" },
    include: {
      user: true,
      plan: true
    }
  });

  console.log("SUBSCRIPTION 95f0d4b6:", {
    subId: sub?.id,
    createdAt: sub?.createdAt,
    startDate: sub?.startDate,
    endDate: sub?.endDate,
    user: {
      id: sub?.user?.id,
      fullName: sub?.user?.fullName,
      email: sub?.user?.email,
      status: sub?.user?.status,
      isVerified: sub?.user?.isVerified,
      verified: sub?.user?.verified,
      kycStatus: (sub?.user as any)?.kycStatus,
      verificationData: sub?.user?.verificationData
    }
  });
}

inspect().finally(() => prisma.$disconnect());
