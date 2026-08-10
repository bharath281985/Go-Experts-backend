import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedSuperAdmin() {
  console.log("Seeding Super Admin into AdminUser table...");

  const email = "admin@goexperts.in";
  const password = "Admin@12345";
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Ensure the super_admin role exists
  let role = await prisma.role.findUnique({ where: { name: "Super Admin" } });
  if (!role) {
      role = await prisma.role.create({
          data: {
              name: "Super Admin",
              description: "Full access",
              status: "active"
          }
      });
  }

  // 2. Upsert the AdminUser
  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {
      password: passwordHash,
      status: "active",
      roleId: role.id
    },
    create: {
      email,
      password: passwordHash,
      fullName: "Super Admin",
      status: "active",
      roleId: role.id
    }
  });

  console.log("==========================================");
  console.log("✅ SUPER ADMIN SUCCESSFULLY CREATED!");
  console.log("==========================================");
  console.log(`Email: ${admin.email}`);
  console.log(`Password: ${password}`);

  await prisma.$disconnect();
}

seedSuperAdmin().catch(console.error);
