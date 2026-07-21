import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const notifs = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("Latest notifications count:", notifs.length);
  console.log("Latest notification sample:", JSON.stringify(notifs[0], null, 2));

  const users = await prisma.user.findMany({
    take: 5,
    select: { id: true, email: true, role: true, fullName: true },
  });
  console.log("Users sample:", users);
}

main().finally(() => prisma.$disconnect());
