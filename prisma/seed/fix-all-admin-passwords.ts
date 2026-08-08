import { prisma } from "../../src/config/database.js";
import bcrypt from "bcrypt";

async function fixAllAdminPasswords() {
  const email = "admin@goexperts.in";
  const password = "Admin@12345";
  const passwordHash = await bcrypt.hash(password, 10);

  // 1. Update in adminUser table
  const adminUser = await prisma.adminUser.updateMany({
    where: { email },
    data: {
      password: passwordHash,
      status: "active",
    },
  });

  // 2. Update in user table
  const user = await prisma.user.updateMany({
    where: { email },
    data: {
      password: passwordHash,
      status: "active",
    },
  });

  console.log("==========================================");
  console.log("✅ BOTH ADMIN TABLES SUCCESSFULLY UPDATED!");
  console.log("==========================================");
  console.log(`Updated ${adminUser.count} rows in adminUser table`);
  console.log(`Updated ${user.count} rows in user table`);
  console.log(`Email: ${email}`);
  console.log(`Password set to: ${password}`);

  await prisma.$disconnect();
}

fixAllAdminPasswords();
