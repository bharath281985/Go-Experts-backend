const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, role: true, email: true }
  });
  console.log("Total users:", users.length);
  console.log("Roles:", [...new Set(users.map(u => u.role))]);
  
  const founders = users.filter(u => u.role === "founder");
  console.log("Founders:", founders);
  
  const freelancers = users.filter(u => u.role === "freelancer");
  console.log("Freelancers:", freelancers.length);
  
  const clients = users.filter(u => u.role === "client");
  console.log("Clients:", clients.length);
  
  const investors = users.filter(u => u.role === "investor");
  console.log("Investors:", investors.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
