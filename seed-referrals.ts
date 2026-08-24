import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Referral Program Data...");

  // 1. Create a Default Evergreen Campaign
  const campaign1 = await prisma.referralCampaign.create({
    data: {
      name: "GoExperts Launch Program",
      status: "ACTIVE",
      rewardType: "CASH"
    }
  });

  // 2. Create a Founder/Investor Special Campaign
  const campaign2 = await prisma.referralCampaign.create({
    data: {
      name: "Startup Ecosystem Invite",
      status: "ACTIVE",
      rewardType: "CREDITS"
    }
  });

  console.log("Created Campaigns:", campaign1.id, campaign2.id);

  // 3. Create Rules for Campaign 1 (Freelancer / Client standard rules)
  await prisma.referralRule.createMany({
    data: [
      {
        campaignId: campaign1.id,
        referrerRole: "FREELANCER",
        referredRole: "CLIENT",
        qualification: "PROJECT_CREATED",
        rewardAmount: 500, // ₹500 for referring a client who creates a project
      },
      {
        campaignId: campaign1.id,
        referrerRole: "FREELANCER",
        referredRole: "FREELANCER",
        qualification: "PROFILE_VERIFIED",
        rewardAmount: 100, // ₹100 for referring another freelancer who gets verified
      },
      {
        campaignId: campaign1.id,
        referrerRole: "CLIENT",
        referredRole: "CLIENT",
        qualification: "PROJECT_CREATED",
        rewardAmount: 1000, // ₹1000 for client referring client
      }
    ]
  });

  // 4. Create Rules for Campaign 2 (Founder / Investor)
  await prisma.referralRule.createMany({
    data: [
      {
        campaignId: campaign2.id,
        referrerRole: "FOUNDER",
        referredRole: "INVESTOR",
        qualification: "PROFILE_VERIFIED",
        rewardAmount: 5000, 
        rewardType: "CREDITS" // Overrides campaign default
      },
      {
        campaignId: campaign2.id,
        referrerRole: "INVESTOR",
        referredRole: "FOUNDER",
        qualification: "PROFILE_VERIFIED",
        rewardAmount: 2000,
        rewardType: "CREDITS"
      }
    ]
  });

  console.log("Referral Rules Seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
