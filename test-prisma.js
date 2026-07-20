import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const meetings = await prisma.meeting.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log("LATEST MEETINGS:", JSON.stringify(meetings, null, 2));
  } catch (e) {
    console.error("PRISMA ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
