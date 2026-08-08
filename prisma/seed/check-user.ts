import { prisma } from "../../src/config/database.js";

async function checkUser() {
  const adminUsers = await prisma.user.findMany({
    where: {
      OR: [
        { role: { contains: "admin" } },
        { email: { contains: "admin" } }
      ]
    },
    select: { id: true, email: true, role: true, status: true }
  });

  console.log("=== ADMIN USERS IN DB ===");
  console.log(`Found ${adminUsers.length} admin accounts:`, JSON.stringify(adminUsers, null, 2));

  await prisma.$disconnect();
}

checkUser();
