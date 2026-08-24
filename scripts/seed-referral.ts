import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.referralCampaign.findFirst({
    where: { name: "Default GoExperts Referral Campaign" }
  });

  if (existing) {
    console.log("Default campaign already exists.");
    return;
  }

  const campaign = await prisma.referralCampaign.create({
    data: {
      name: "Default GoExperts Referral Campaign",
      description: "Base platform referral campaign.",
      status: "ACTIVE",
      rules: {
        create: [
          {
            referrerRole: "ANY",
            referredRole: "ANY",
            rewardType: "CREDIT",
            rewardAmount: 500,
            qualification: "SIGNUP"
          }
        ]
      }
    }
  });

  console.log("Created Default Campaign:", campaign.id);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
