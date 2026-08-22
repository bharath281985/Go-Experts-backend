const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      client: true,
      title: true
    }
  });

  const clientIds = [...new Set(projects.map(p => p.client))];
  
  const clients = await prisma.user.findMany({
    where: {
      id: {
        in: clientIds
      }
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true
    }
  });
  
  console.log("Clients with projects:", clients.length);
  console.dir(clients, { depth: null });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
