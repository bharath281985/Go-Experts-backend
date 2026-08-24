const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Finding a client user...');
  const user = await prisma.user.findFirst({
    where: { role: 'client' },
    orderBy: { createdAt: 'desc' }
  });

  if (!user) {
    console.log('No client user found!');
    return;
  }

  console.log('Seeding team members for client:', user.email);

  await prisma.clientTeamMember.createMany({
    data: [
      {
        clientId: user.id,
        name: 'Sarah Connor',
        email: 'sarah.c@example.com',
        role: 'Manager',
        department: 'Operations',
        status: 'Active',
        permissions: JSON.stringify(['can_hire', 'can_manage_projects'])
      },
      {
        clientId: user.id,
        name: 'John Doe',
        email: 'john.d@example.com',
        role: 'Member',
        department: 'Engineering',
        status: 'Invited',
        permissions: JSON.stringify([])
      },
      {
        clientId: user.id,
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
