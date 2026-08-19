const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting relation seeding...");

  // 1. Seed Countries
  const countries = [
    { name: "United States", code: "US" },
    { name: "United Kingdom", code: "UK" },
    { name: "India", code: "IN" },
    { name: "Australia", code: "AU" },
    { name: "Canada", code: "CA" },
  ];

  for (const c of countries) {
    try {
      const existing = await prisma.country.findFirst({ where: { name: c.name } });
      if (!existing) {
        await prisma.country.create({ data: { name: c.name, code: c.code, status: "active" } });
        console.log(`Created country: ${c.name}`);
      }
    } catch (e) {
      console.log(`Skipped ${c.name} due to constraint`);
    }
  }

  // 2. Migrate Cities from master_options (if available)
  const india = await prisma.country.findFirst({ where: { name: "India" } });
  if (india) {
    const cityOptions = await prisma.masterOption.findMany({ where: { type: "city" } });
    let cityCount = 0;
    for (const c of cityOptions) {
      const existing = await prisma.city.findFirst({ where: { name: c.label } });
      if (!existing) {
        await prisma.city.create({
          data: { name: c.label, countryId: india.id, status: c.status || "active" }
        });
        cityCount++;
      }
    }
    console.log(`Migrated ${cityCount} cities to India.`);
  }

  // 3. Migrate Industries and Categories
  const industries = await prisma.masterOption.findMany({ where: { type: "industry" } });
  let indCount = 0;
  for (const i of industries) {
    let existing = await prisma.industry.findFirst({ where: { name: i.label } });
    if (!existing) {
      existing = await prisma.industry.create({
        data: { name: i.label, status: i.status || "active" }
      });
      indCount++;
    }
    
    // For each industry, find its categories (assuming they are mapped or we just create a general one)
    // Actually, categories in master_options usually have type='category' or similar.
  }
  console.log(`Migrated ${indCount} industries.`);

  const categories = await prisma.masterOption.findMany({ where: { type: "category" } });
  let catCount = 0;
  for (const c of categories) {
    const existing = await prisma.skillCategory.findFirst({ where: { name: c.label } });
    if (!existing) {
      await prisma.skillCategory.create({
        data: { name: c.label, status: c.status || "active" }
      });
      catCount++;
    }
  }
  console.log("Seeding complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
