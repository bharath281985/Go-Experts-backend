import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.notification.updateMany({
    where: { status: "draft" },
    data: { status: "unread" },
  });
  console.log(`Updated ${result.count} notifications from "draft" to "unread".`);
}

main().finally(() => prisma.$disconnect());
