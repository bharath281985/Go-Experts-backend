import { prisma } from "../config/database.js";
import bcrypt from "bcrypt";

async function main() {
  const password = await bcrypt.hash("Goexperts@2025", 12);

  // Ensure Super Admin role exists
  let role = await prisma.role.findFirst({ where: { name: "Super Admin" } });
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: "Super Admin",
        description: "Super Administrator with Full Access",
      },
    });
  }

  // Ensure admin@goexperts.in exists
  await prisma.adminUser.upsert({
    where: { email: "admin@goexperts.in" },
    update: { password },
    create: {
      email: "admin@goexperts.in",
      password,
      fullName: "Go Experts Super Admin",
      roleId: role.id,
    },
  });

  // Ensure superadmin@goexperts.com exists
  await prisma.adminUser.upsert({
    where: { email: "superadmin@goexperts.com" },
    update: { password },
    create: {
      email: "superadmin@goexperts.com",
      password,
      fullName: "Super Admin",
      roleId: role.id,
    },
  });

  console.log("SUCCESS: Created/updated Super Admin accounts (admin@goexperts.in and superadmin@goexperts.com) with password 'Goexperts@2025'");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
