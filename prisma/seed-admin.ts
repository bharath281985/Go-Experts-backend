import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@goexperts.in';
  const plainPassword = 'Password123!'; // Default password
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  console.log(`Seeding super admin: ${email}...`);

  // Create or update the admin user
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      status: 'active',
    },
    create: {
      email,
      password: hashedPassword,
      fullName: 'Super Admin',
      status: 'active',
      role: {
        connectOrCreate: {
          where: { name: 'super_admin' },
          create: { name: 'super_admin', description: 'Super Administrator' },
        },
      },
    },
  });

  console.log('Successfully seeded super admin!', admin);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
