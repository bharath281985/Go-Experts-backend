const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedMasterRoles() {
  console.log('Seeding client_roles into master_options...');
  const rolesToSeed = [
    { label: 'Admin', value: 'Admin' },
    { label: 'Manager', value: 'Manager' },
    { label: 'Member', value: 'Member' },
    { label: 'Viewer', value: 'Viewer' }
  ];

  let sort = 1;
  for (const r of rolesToSeed) {
    // Check if exists
    const existing = await prisma.masterOption.findFirst({
      where: { type: 'client_role', value: r.value }
    });
    if (!existing) {
      await prisma.masterOption.create({
        data: {
          type: 'client_role',
          label: r.label,
          value: r.value,
          sortOrder: sort++
        }
      });
    }
  }
  console.log('Client roles seeded successfully in Master Options!');
}

seedMasterRoles().catch(console.error).finally(() => prisma.$disconnect());
