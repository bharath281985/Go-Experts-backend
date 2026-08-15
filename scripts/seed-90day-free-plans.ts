import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const freePlans = [
    {
      name: "Freelancer 90-Day Free Trial",
      role: "freelancer",
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
        "Full Platform Access for 90 Days",
        "Apply to unlimited projects",
        "Direct client messaging & chat"
      ]),
      limits: JSON.stringify({ applications: 999 })
    },
    {
      name: "Client 90-Day Free Trial",
      role: "client",
      amount: 0,
      originalAmount: 1499,
      savedBadge: "100% Free for 90 Days",
      currency: "INR",
      duration: "90_days",
      popular: false,
      recommended: false,
      visibility: "public",
      status: "active",
      features: JSON.stringify([
        "Full Platform Access for 90 Days",
        "Post unlimited jobs & projects",
        "Direct freelancer contact & chat"
      ]),
      limits: JSON.stringify({ jobPosts: 999 })
    },
    {
      name: "Founder 90-Day Free Trial",
      role: "founder",
      amount: 0,
      originalAmount: 1999,
      savedBadge: "100% Free for 90 Days",
      currency: "INR",
      duration: "90_days",
      popular: false,
      recommended: false,
      visibility: "public",
      status: "active",
      features: JSON.stringify([
        "Full Startup OS Access for 90 Days",
        "Publish profile & connect with investors",
        "Direct specialist hiring"
      ]),
      limits: JSON.stringify({ outreaches: 999 })
    },
    {
      name: "Investor 90-Day Free Trial",
      role: "investor",
      amount: 0,
      originalAmount: 2499,
      savedBadge: "100% Free for 90 Days",
      currency: "INR",
      duration: "90_days",
      popular: false,
      recommended: false,
      visibility: "public",
      status: "active",
      features: JSON.stringify([
        "Full Investor Console for 90 Days",
        "Curated deal flow & startup access",
        "Direct founder intros & pitches"
      ]),
      limits: JSON.stringify({ reviews: 999 })
    }
  ];

  console.log("Seeding 90-Day Free Plans for all roles...");

  for (const plan of freePlans) {
    const existing = await prisma.subscriptionPlan.findFirst({
      where: {
        OR: [
          { name: plan.name },
          { role: plan.role, duration: "90_days" },
          { role: plan.role, amount: 0 }
        ]
      }
    });

    if (existing) {
      const updated = await prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: {
          name: plan.name,
          role: plan.role,
          amount: plan.amount,
          originalAmount: plan.originalAmount,
          savedBadge: plan.savedBadge,
          currency: plan.currency,
          duration: plan.duration,
          status: "active",
          features: plan.features,
          limits: plan.limits
        }
      });
      console.log(`Updated 90-Day Free Plan: ${updated.name} (Role: ${updated.role})`);
    } else {
      const created = await prisma.subscriptionPlan.create({
        data: {
          name: plan.name,
          role: plan.role,
          amount: plan.amount,
          originalAmount: plan.originalAmount,
          savedBadge: plan.savedBadge,
          currency: plan.currency,
          duration: plan.duration,
          popular: false,
          recommended: false,
          visibility: "public",
          status: "active",
          features: plan.features,
          limits: plan.limits
        }
      });
      console.log(`Created 90-Day Free Plan: ${created.name} (Role: ${created.role})`);
    }
  }

  console.log("Successfully seeded 90-Day Free Plans for all 4 roles!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
