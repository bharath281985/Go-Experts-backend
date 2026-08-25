const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const userId = '2a1a8bbd-5551-4aa3-ad88-6fc529694de6';
  console.log('Seeding team members for client:', userId);

  await prisma.clientTeamMember.createMany({
    data: [
      {
        clientId: userId,
        name: 'Sarah Connor',
        email: 'sarah.c@example.com',
        role: 'Manager',
        department: 'Operations',
        status: 'Active',
        permissions: JSON.stringify(['can_hire', 'can_manage_projects'])
      },
      {
        clientId: userId,
        name: 'John Doe',
        email: 'john.d@example.com',
        role: 'Member',
        department: 'Engineering',
        status: 'Invited',
        permissions: JSON.stringify([])
      },
      {
        clientId: userId,
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'Admin',
        department: 'Management',
        status: 'Active',
        permissions: JSON.stringify(['can_hire', 'can_pay', 'can_manage_team', 'can_manage_projects'])
      }
    ]
  });
  console.log('Seeding complete!');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
