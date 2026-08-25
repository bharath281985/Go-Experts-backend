const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedRoles() {
  console.log('Seeding roles into DB...');
  const rolesToSeed = [
    { name: 'Admin', description: 'Full access to all client features' },
    { name: 'Manager', description: 'Can manage projects and team' },
    { name: 'Member', description: 'Standard access' },
    { name: 'Viewer', description: 'Read-only access' }
  ];

  for (const r of rolesToSeed) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description, status: 'active' }
    });
  }
  
  console.log('Roles seeded successfully!');
}

seedRoles().catch(console.error).finally(() => prisma.$disconnect());
