import { prisma } from "../../src/config/database.js";
import bcrypt from "bcrypt";

async function testLogin() {
  const email = "admin@goexperts.in";
  const password = "Admin@12345";

  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    console.log("❌ User not found!");
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  console.log("=== LOGIN TEST RESULT ===");
  console.log(`User ID: ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Password bcrypt match: ${isPasswordValid ? "✅ MATCHED!" : "❌ MISMATCH"}`);

  await prisma.$disconnect();
}

testLogin();
