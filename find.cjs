const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  const client = await prisma.user.findFirst({
    where: { role: "client", projects: { some: {} } },
    include: { projects: true }
  });
  const freelancer = await prisma.user.findFirst({
    where: { role: "freelancer" }
  });
  
  const password = "Goexperts@2025";
  const hashedPassword = await bcrypt.hash(password, 10);
  
  if (client) {
    await prisma.user.update({ where: { id: client.id }, data: { password: hashedPassword } });
    console.log("Client Email:", client.email);
    console.log("Client Password:", password);
  } else {
    console.log("No client with projects found!");
  }
  
  if (freelancer) {
    await prisma.user.update({ where: { id: freelancer.id }, data: { password: hashedPassword } });
    console.log("Freelancer Email:", freelancer.email);
    console.log("Freelancer Password:", password);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

