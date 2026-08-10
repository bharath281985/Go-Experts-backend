import { prisma } from "../config/database.js";
import bcrypt from "bcrypt";

async function main() {
  const adminUsers = await prisma.adminUser.findMany();
  console.log("Found adminUser records:", adminUsers.length);
  for (const u of adminUsers) {
    console.log(`- Email: ${u.email}, ID: ${u.id}, Status: ${u.status}`);
    const check12345 = await bcrypt.compare("Admin@12345", u.password).catch(() => false);
    const check123 = await bcrypt.compare("Admin@123", u.password).catch(() => false);
    const check2025 = await bcrypt.compare("Goexperts@2025", u.password).catch(() => false);
    console.log(`  Password matches "Admin@12345": ${check12345}`);
    console.log(`  Password matches "Admin@123": ${check123}`);
    console.log(`  Password matches "Goexperts@2025": ${check2025}`);
  }

  // Set admin@goexperts.in password to "Admin@12345"
  const newHash = await bcrypt.hash("Admin@12345", 10);
  await prisma.adminUser.upsert({
    where: { email: "admin@goexperts.in" },
    update: { password: newHash, status: "active" },
    create: {
      email: "admin@goexperts.in",
      password: newHash,
      fullName: "Super Admin",
      status: "active",
      role: { connectOrCreate: { where: { name: "super_admin" }, create: { name: "super_admin" } } }
    } as any,
  });

  await prisma.user.upsert({
    where: { email: "admin@goexperts.in" },
    update: { password: newHash, status: "active" },
    create: {
      email: "admin@goexperts.in",
      password: newHash,
      fullName: "Super Admin",
      role: "super_admin",
      status: "active",
    },
  });

  console.log("✅ FORCED PASSWORD FOR admin@goexperts.in TO: Admin@12345");
  await prisma.$disconnect();
}

main().catch(console.error);
