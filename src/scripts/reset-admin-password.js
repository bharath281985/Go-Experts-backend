import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

let prisma;
try {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL?.includes("root:@")
          ? process.env.DATABASE_URL
          : "mysql://root:@localhost:3306/expertsportal_adminaigravity"
      }
    }
  });
} catch {
  prisma = new PrismaClient();
}

async function main() {
  const passwordHash = await bcrypt.hash('Admin@12345', 10);

  // 1. Ensure Super Admin role exists
  let superRole = await prisma.role.findFirst({ where: { name: "Super Admin" } });
  if (!superRole) {
    superRole = await prisma.role.create({
      data: {
        name: "Super Admin",
        description: "Super Administrator with Full Access",
      },
    });
  }

  // 2. Set adminUser for admin@goexperts.in
  await prisma.adminUser.upsert({
    where: { email: "admin@goexperts.in" },
    update: { password: passwordHash, status: "active", roleId: superRole.id },
    create: {
      email: "admin@goexperts.in",
      password: passwordHash,
      fullName: "Go Experts Super Admin",
      roleId: superRole.id,
      status: "active",
    },
  });

  // 3. Set adminUser for superadmin@goexperts.com
  await prisma.adminUser.upsert({
    where: { email: "superadmin@goexperts.com" },
    update: { password: passwordHash, status: "active", roleId: superRole.id },
    create: {
      email: "superadmin@goexperts.com",
      password: passwordHash,
      fullName: "Super Admin",
      roleId: superRole.id,
      status: "active",
    },
  });

  console.log("==========================================");
  console.log("✅ SUPER ADMIN PASSWORDS SUCCESSFULLY SET!");
  console.log("==========================================");
  console.log("Email: admin@goexperts.in");
  console.log("Password: Admin@12345");
  console.log("------------------------------------------");
  console.log("Email: superadmin@goexperts.com");
  console.log("Password: Admin@12345");
  console.log("==========================================");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
