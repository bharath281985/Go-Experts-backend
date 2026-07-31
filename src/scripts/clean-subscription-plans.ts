import { prisma } from "../config/database.js";

const roles = ["freelancer", "client", "investor", "founder"];

async function main() {
  console.log("Cleaning subscription_plans table to keep ONLY Admin decided plans...");

  const allowedNames: string[] = [];

  for (const r of roles) {
    const roleCapitalized = r.charAt(0).toUpperCase() + r.slice(1);
    const monthlyName = `${roleCapitalized} Monthly`;
    const annualName = `${roleCapitalized} Annual`;
    allowedNames.push(monthlyName, annualName);

    // 1. Monthly Plan (₹799/month, Original ₹999)
    await prisma.subscriptionPlan.upsert({
      where: { name: monthlyName },
      create: {
        name: monthlyName,
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
      where: { name: annualName },
      create: {
        name: annualName,
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

  // Delete all old unneeded plans that are NOT in allowedNames
  const deleted = await prisma.subscriptionPlan.deleteMany({
    where: {
      name: { notIn: allowedNames },
    },
  });

  console.log(`Deleted ${deleted.count} old unneeded subscription plans.`);
  console.log("Database subscription_plans table clean sync complete!");
  await prisma.$disconnect();
}

main().catch(console.error);
