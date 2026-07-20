const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { role: true },
    distinct: ["role"]
  });
  console.log("Distinct roles:", users.map(u => u.role));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
