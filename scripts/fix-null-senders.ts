import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const convs = await prisma.conversation.findMany({
    select: { id: true, userA: true, userB: true }
  });

  let totalFixed = 0;

  for (const conv of convs) {
    const msgs = await prisma.message.findMany({
      where: { conversationId: conv.id, senderId: null }
    });

    for (const msg of msgs) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(msg.from);
      if (isUUID) {
        await prisma.message.update({ where: { id: msg.id }, data: { senderId: msg.from } });
        totalFixed++;
      } else if (msg.from === "me" && conv.userA) {
        await prisma.message.update({ where: { id: msg.id }, data: { senderId: conv.userA } });
        totalFixed++;
      }
    }
  }

  console.log("Fixed " + totalFixed + " messages with null senderId");
  await prisma.$disconnect();
}

main().catch(console.error);
