const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting Rupee substitution...");

  // Update Master Options
  const masterOptions = await prisma.masterOption.findMany({
    where: { label: { contains: '$' } }
  });

  let moCount = 0;
  for (const mo of masterOptions) {
    const newLabel = mo.label.replace(/\$/g, '₹');
    const newValue = mo.value.replace(/\$/g, '₹');
    await prisma.masterOption.update({
      where: { id: mo.id },
      data: { label: newLabel, value: newValue }
    });
    moCount++;
  }
  console.log(`Updated ${moCount} MasterOptions to use ₹.`);

  console.log("Rupee replacement complete.");
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
  });
