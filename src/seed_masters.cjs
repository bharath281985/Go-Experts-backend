const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const expCount = await prisma.experienceLevel.count();
  if (expCount === 0) {
    const items = [
      { name: 'Entry Level (0-2 Yrs)', status: 'active' },
      { name: 'Intermediate (2-5 Yrs)', status: 'active' },
      { name: 'Senior Level (5-8 Yrs)', status: 'active' },
      { name: 'Lead / Principal (8-12 Yrs)', status: 'active' },
      { name: 'Executive / Director (12+ Yrs)', status: 'active' }
    ];
    for (const it of items) {
      await prisma.experienceLevel.create({ data: it });
    }
    console.log('Seeded 5 ExperienceLevels');
  } else {
    console.log('ExperienceLevels already present:', expCount);
  }

  const engCount = await prisma.masterOption.count({ where: { type: 'engagement_type' } });
  if (engCount === 0) {
    const engs = ['Full-Time Contract', 'Part-Time Advisory', 'Project Milestone', 'Retainer Basis', 'Hourly Gig'];
    for (let i = 0; i < engs.length; i++) {
      await prisma.masterOption.create({
        data: { type: 'engagement_type', label: engs[i], value: engs[i], status: 'active', sortOrder: i + 1 }
      });
    }
    console.log('Seeded 5 EngagementTypes');
  } else {
    console.log('EngagementTypes already present:', engCount);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error(err);
    prisma.$disconnect();
  });
