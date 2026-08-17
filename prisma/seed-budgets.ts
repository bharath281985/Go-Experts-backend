import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Cleaning old budget ranges...");
  
  const types = ["budget_range", "project_budget_range", "hiring_budget_range"];

  // Delete old ones to prevent duplicates
  await (prisma as any).masterOption.deleteMany({
    where: {
      type: { in: types }
    }
  });

  console.log("🌱 Seeding Budget Ranges in INR (₹)...");

  const budgetRanges = [
    { label: "Less than ₹10,000", value: "<10000", min: 0, max: 10000, sortOrder: 1 },
    { label: "₹10,000 - ₹50,000", value: "10000-50000", min: 10000, max: 50000, sortOrder: 2 },
    { label: "₹50,000 - ₹1,00,000", value: "50000-100000", min: 50000, max: 100000, sortOrder: 3 },
    { label: "₹1,00,000 - ₹5,00,000", value: "100000-500000", min: 100000, max: 500000, sortOrder: 4 },
    { label: "₹5,00,000+", value: ">500000", min: 500000, max: null, sortOrder: 5 },
  ];

  for (const type of types) {
    for (const range of budgetRanges) {
      await (prisma as any).masterOption.create({
          data: {
            type,
            label: range.label,
            value: range.value,
            min: range.min,
            max: range.max,
            sortOrder: range.sortOrder,
            status: "active",
          }
      });
    }
  }

  console.log("✅ Budget Ranges in INR Seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
