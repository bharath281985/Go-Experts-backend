const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Linking unassigned skills to a default category and industry...");

  // Get first available industry and category
  const defaultIndustry = await prisma.industry.findFirst({ where: { status: 'active' } });
  const defaultCategory = await prisma.category.findFirst({ where: { status: 'active' } });

  if (!defaultIndustry || !defaultCategory) {
    console.log("Error: Please make sure you have at least one active Industry and Category in the database first.");
    return;
  }

  // Find all skills that are unlinked
  const unlinkedSkills = await prisma.skill.findMany({
    where: {
      OR: [
        { categoryId: null },
        { industry: null }
      ]
    },
    select: { id: true }
  });

  if (unlinkedSkills.length === 0) {
    console.log("All skills are already linked.");
    return;
  }

  console.log(`Found ${unlinkedSkills.length} unlinked skills. Linking them now...`);

  let count = 0;
  for (const skill of unlinkedSkills) {
    await prisma.skill.update({
      where: { id: skill.id },
      data: {
        categoryId: defaultCategory.id,
        industry: defaultIndustry.id, // The schema has this field as 'industry', but we store the ID string here
      }
    });
    count++;
    if (count % 100 === 0) console.log(`Linked ${count} skills...`);
  }

  console.log(`Successfully linked ${count} skills to Industry '${defaultIndustry.name}' and Category '${defaultCategory.name}'.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
