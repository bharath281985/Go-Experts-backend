import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function seed() {
  console.log("Starting seeding role-based referral rules...");

  // Create or find a role-based campaign
  const campaign = await prisma.referralCampaign.create({
    data: {
      name: "Role-Based Referral Rewards",
      status: "ACTIVE",
      rewardType: "CASH", 
    }
  });

  const roles = [
    { role: "freelancer", reward: 100.0 },
    { role: "client", reward: 200.0 },
    { role: "founder", reward: 300.0 },
    { role: "investor", reward: 500.0 },
  ];
  
  // Seed role-level rules
  for (const { role, reward } of roles) {
    await prisma.referralRule.create({
      data: {
        campaignId: campaign.id,
        referrerRole: "ANY",
        referredRole: role,
        qualification: "ACCOUNT_ACTIVATION", // Example qualification event
        rewardAmount: reward,
        rewardType: "CASH",
        industry: "All Industries",
      }
    });
  }
  
  console.log("Successfully seeded Role-Based Referral Rules!");
}

seed().catch(e => {
  console.error("Error during seeding:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
