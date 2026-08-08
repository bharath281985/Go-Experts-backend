import { prisma } from "../../src/config/database.js";
import bcrypt from "bcrypt";

async function checkBothAdminTables() {
  const email = "admin@goexperts.in";

  const adminInAdminUser = await prisma.adminUser.findFirst({ where: { email } });
  const adminInUser = await prisma.user.findFirst({ where: { email } });

  console.log("=== CHECK ADMIN TABLES ===");
  console.log("In adminUser table:", adminInAdminUser ? {
    id: adminInAdminUser.id,
    email: adminInAdminUser.email,
    status: adminInAdminUser.status,
    passwordHash: adminInAdminUser.password ? adminInAdminUser.password.substring(0, 20) + "..." : "NULL"
  } : "NOT FOUND");

  console.log("In user table:", adminInUser ? {
    id: adminInUser.id,
    email: adminInUser.email,
    role: adminInUser.role,
    status: adminInUser.status,
    passwordHash: adminInUser.password ? adminInUser.password.substring(0, 20) + "..." : "NULL"
  } : "NOT FOUND");

  await prisma.$disconnect();
}

checkBothAdminTables();
