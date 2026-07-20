import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Test Database...");

  const hashedPassword = await bcrypt.hash("TestPass123!", 10);

  // 1. Create Test Admin
  await prisma.adminUser.upsert({
    where: { email: "test-admin@goexperts.com" },
    update: {},
    create: {
      email: "test-admin@goexperts.com",
      password: hashedPassword,
      fullName: "Test Admin",
      status: "active",
      roleId: "super_admin",
    },
  });

  // 2. Create Test User
  await prisma.user.upsert({
    where: { email: "test-client@goexperts.com" },
    update: {},
    create: {
      email: "test-client@goexperts.com",
      password: hashedPassword,
      firstName: "Test",
      lastName: "Client",
      type: "client",
      status: "active",
      isEmailVerified: true,
    },
  });

  // 3. Create Basic API Key for testing
  await prisma.apiKey.upsert({
    where: { keyHash: "test_hash" },
    update: {},
    create: {
      name: "Test API Key",
      keyHash: "test_hash",
      maskedKey: "gk_test_...1234",
      scopes: "read:all",
      roleMapping: "admin",
      status: "active",
    },
  });

  console.log("✅ Test Database Seed Complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
