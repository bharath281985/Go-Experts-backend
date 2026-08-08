import { prisma } from "../../src/config/database.js";
import bcrypt from "bcrypt";

async function createAdmin() {
  const email = "admin@goexperts.in";
  const password = "Admin@12345";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      fullName: "Super Admin",
      password: passwordHash,
      role: "admin",
      status: "active",
      phone: "+919999999999",
    },
    update: {
      fullName: "Super Admin",
      password: passwordHash,
      role: "admin",
      status: "active",
      phone: "+919999999999",
    },
  });

  console.log("==========================================");
  console.log("✅ ADMIN USER SUCCESSFULLY CREATED / UPDATED!");
  console.log("==========================================");
  console.log(`ID: ${admin.id}`);
  console.log(`Email: ${admin.email}`);
  console.log(`Role: ${admin.role}`);
  console.log(`Status: ${admin.status}`);
  console.log(`Password set to: ${password}`);

  await prisma.$disconnect();
}

createAdmin();
