const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({
    where: { client: { not: "" } }
  });
  
  if (project) {
    const clientUser = await prisma.user.findFirst({
      where: { id: project.client }
    });
    
    if (clientUser) {
      const password = "Goexperts@2025";
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { id: clientUser.id }, data: { password: hashedPassword } });
      
      console.log("Found Client with Projects!");
      console.log("Client Email:", clientUser.email);
      console.log("Client Password:", password);
    } else {
       console.log("Project found, but linked client user does not exist:", project.client);
    }
  } else {
    console.log("No projects found in the database at all!");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

