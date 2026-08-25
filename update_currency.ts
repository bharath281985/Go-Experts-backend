import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting mass update of currency from USD to INR...");
  
  const tables = [
    'jobOpening',
    'freelancerProfile',
    'clientProfile',
    'wallet',
    'payment',
    'transaction',
    'subscriptionPlan'
  ];

  for (const table of tables) {
    if (prisma[table]) {
      try {
        const result = await (prisma[table] as any).updateMany({
          where: { currency: "USD" },
          data: { currency: "INR" }
        });
        console.log(`Updated ${result.count} records in ${table}.`);
      } catch (e) {
        console.log(`Could not update currency for ${table}:`, e.message);
      }
    } else {
      console.log(`Table ${table} not found in Prisma Client.`);
    }
  }

  // Update Countries explicitly for currencyCode and symbol
  if (prisma.country) {
    try {
      const countryResult = await prisma.country.updateMany({
        where: { currencyCode: "USD" },
        data: { currencyCode: "INR", currencySymbol: "₹" }
      });
      console.log(`Updated ${countryResult.count} Countries.`);
    } catch (e) {
        console.log(`Could not update currency for countries:`, e.message);
    }
  }

  console.log("Finished currency update successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
