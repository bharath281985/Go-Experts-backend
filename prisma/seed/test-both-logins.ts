import { prisma } from "../../src/config/database.js";
import bcrypt from "bcrypt";

async function testBothLogins() {
  const email = "admin@goexperts.in";
  const password = "Admin@12345";

  const adminInAdminUser = await prisma.adminUser.findFirst({ where: { email } });
  const adminInUser = await prisma.user.findFirst({ where: { email } });

  const adminMatch = adminInAdminUser ? await bcrypt.compare(password, adminInAdminUser.password) : false;
  const userMatch = adminInUser ? await bcrypt.compare(password, adminInUser.password) : false;

  console.log("=== FINAL LOGIN VERIFICATION ===");
  console.log(`adminUser table password match: ${adminMatch ? "✅ MATCHED!" : "❌ MISMATCH"}`);
  console.log(`user table password match: ${userMatch ? "✅ MATCHED!" : "❌ MISMATCH"}`);

  await prisma.$disconnect();
}

testBothLogins();
