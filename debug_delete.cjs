const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const id = '9bbe925a-6b74-46ca-925a-afeece143ff0';
    await prisma.user.delete({ where: { id } });
    console.log("Success");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
