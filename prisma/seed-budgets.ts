import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Budget Ranges...");

  const budgetRanges = [
    { label: "Less than $1,000", value: "<1000", min: 0, max: 1000, sortOrder: 1 },
    { label: "$1,000 - $5,000", value: "1000-5000", min: 1000, max: 5000, sortOrder: 2 },
    { label: "$5,000 - $10,000", value: "5000-10000", min: 5000, max: 10000, sortOrder: 3 },
    { label: "$10,000 - $50,000", value: "10000-50000", min: 10000, max: 50000, sortOrder: 4 },
    { label: "$50,000+", value: ">50000", min: 50000, max: null, sortOrder: 5 },
  ];

  const types = ["budget_range", "project_budget_range", "hiring_budget_range"];

  for (const type of types) {
    for (const range of budgetRanges) {
      await (prisma as any).masterOption.upsert({
        where: {
          id: `seed_${type}_${range.sortOrder}` // Use a unique but consistent ID if possible, but masterOption doesn't have a unique constraint on type+value
        },
        create: {
          type,
          label: range.label,
          value: range.value,
          min: range.min,
          max: range.max,
          sortOrder: range.sortOrder,
          status: "active",
        },
        update: {
          label: range.label,
          value: range.value,
          min: range.min,
          max: range.max,
          sortOrder: range.sortOrder,
        }
      }).catch(async (e: any) => {
          // If the unique constraint on ID fails because it's generating UUIDs automatically, 
          // we can just check if it exists by type and value
          const existing = await (prisma as any).masterOption.findFirst({
              where: { type, value: range.value }
          });
          if (!existing) {
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
      });
    }
  }

  console.log("✅ Budget Ranges Seeded successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
