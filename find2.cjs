const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  const clientProfile = await prisma.clientProfile.findFirst({
    include: { user: true }
  });
  const freelancerProfile = await prisma.freelancerProfile.findFirst({
    include: { user: true }
  });
  
  const password = "Goexperts@2025";
  const hashedPassword = await bcrypt.hash(password, 10);
  
  if (clientProfile && clientProfile.user) {
    await prisma.user.update({ where: { id: clientProfile.user.id }, data: { password: hashedPassword } });
    console.log("Client Email:", clientProfile.user.email);
    console.log("Client Password:", password);
  } else {
    console.log("No client found!");
  }
  
  if (freelancerProfile && freelancerProfile.user) {
    await prisma.user.update({ where: { id: freelancerProfile.user.id }, data: { password: hashedPassword } });
    console.log("Freelancer Email:", freelancerProfile.user.email);
    console.log("Freelancer Password:", password);
  } else {
    console.log("No freelancer found!");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

