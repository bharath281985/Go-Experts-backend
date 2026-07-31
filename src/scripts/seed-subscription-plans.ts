import { prisma } from "../config/database.js";

const roles = ["freelancer", "client", "investor", "founder"];

async function main() {
  console.log("Seeding subscription plans in database...");

  // Deactivate or delete old generic plans
  await prisma.subscriptionPlan.updateMany({
    data: { status: "inactive" },
  });

  for (const r of roles) {
    const roleCapitalized = r.charAt(0).toUpperCase() + r.slice(1);

    // 1. Monthly Plan (₹799/month, Original ₹999)
    await prisma.subscriptionPlan.upsert({
      where: { name: `${roleCapitalized} Monthly` },
      create: {
        name: `${roleCapitalized} Monthly`,
        role: r,
        amount: 799,
        originalAmount: 999,
        savedBadge: "Save ₹200/mo",
        currency: "INR",
        duration: "monthly",
        features: JSON.stringify([
          "Full access to post, search & connect",
          "Standard search visibility",
          "Basic messaging & project pitching",
        ]),
        recommended: false,
        visibility: "public",
        status: "active",
      },
      update: {
        role: r,
        amount: 799,
        originalAmount: 999,
        savedBadge: "Save ₹200/mo",
        currency: "INR",
        duration: "monthly",
        recommended: false,
        visibility: "public",
        status: "active",
      },
    });

    // 2. Annual Plan (₹5,999/year, Original ₹9,588 - 37% Savings)
    await prisma.subscriptionPlan.upsert({
      where: { name: `${roleCapitalized} Annual` },
      create: {
        name: `${roleCapitalized} Annual`,
        role: r,
        amount: 5999,
        originalAmount: 9588,
        savedBadge: "Save 37% (₹3,589/yr)",
        currency: "INR",
        duration: "yearly",
        features: JSON.stringify([
          "All Monthly features included",
          "Priority 1st-page search listing",
          "Verified trust badge",
          "Save ₹3,589 vs monthly plan",
        ]),
        recommended: true,
        visibility: "public",
        status: "active",
      },
      update: {
        role: r,
        amount: 5999,
        originalAmount: 9588,
        savedBadge: "Save 37% (₹3,589/yr)",
        currency: "INR",
        duration: "yearly",
        recommended: true,
        visibility: "public",
        status: "active",
      },
    });
  }

  console.log("Subscription plans successfully seeded for all 4 roles!");
  await prisma.$disconnect();
}

main().catch(console.error);
