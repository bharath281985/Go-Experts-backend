import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up old multi-role free trial plans...");

  // Remove the previous 4 separate role plans if they exist
  await prisma.subscriptionPlan.deleteMany({
    where: {
      name: {
        in: [
          "Freelancer 90-Day Free Trial",
          "Client 90-Day Free Trial",
          "Founder 90-Day Free Trial",
          "Investor 90-Day Free Trial"
        ]
      }
    }
  }).catch(() => {});

  console.log("Creating single unified 90-Day Free Plan for all 4 roles...");

  const singleFreePlan = {
    name: "90-Day Free Trial",
    role: "all",
    amount: 0,
    originalAmount: 999,
    savedBadge: "100% Free for 90 Days",
    currency: "INR",
    duration: "90_days",
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
    features: JSON.stringify([
      "90 Days Full Platform Access",
      "Unlimited Job & Project Applications",
      "Direct Messaging & Networking for All Roles"
    ]),
    limits: JSON.stringify({
      allAccess: true,
      limit: 999
    })
  };

  const existing = await prisma.subscriptionPlan.findFirst({
    where: {
      OR: [
        { name: singleFreePlan.name },
        { role: "all", duration: "90_days" },
        { role: "all", amount: 0 }
      ]
    }
  });

  if (existing) {
    const updated = await prisma.subscriptionPlan.update({
      where: { id: existing.id },
      data: {
        name: singleFreePlan.name,
        role: singleFreePlan.role,
        amount: singleFreePlan.amount,
        originalAmount: singleFreePlan.originalAmount,
        savedBadge: singleFreePlan.savedBadge,
        currency: singleFreePlan.currency,
        duration: singleFreePlan.duration,
        status: "active",
        features: singleFreePlan.features,
        limits: singleFreePlan.limits
      }
    });
    console.log(`✅ Updated Single 90-Day Free Plan: ${updated.name} (Role: ${updated.role})`);
  } else {
    const created = await prisma.subscriptionPlan.create({
      data: {
        name: singleFreePlan.name,
        role: singleFreePlan.role,
        amount: singleFreePlan.amount,
        originalAmount: singleFreePlan.originalAmount,
        savedBadge: singleFreePlan.savedBadge,
        currency: singleFreePlan.currency,
        duration: singleFreePlan.duration,
        popular: false,
        recommended: false,
        visibility: "public",
        status: "active",
        features: singleFreePlan.features,
        limits: singleFreePlan.limits
      }
    });
    console.log(`✅ Created Single 90-Day Free Plan: ${created.name} (Role: ${created.role})`);
  }

  console.log("Successfully configured 1 single Free Plan for all 4 roles!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
