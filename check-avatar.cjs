const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { email: "saikirangoexperts3@gmail.com" } });
  console.log("Avatar URL:", user.avatarUrl);
}
main().catch(console.error).finally(() => prisma.$disconnect());

