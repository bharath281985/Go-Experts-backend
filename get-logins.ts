import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function getLogins() {
  const freelancer = await prisma.user.findFirst({
    where: { role: "freelancer" },
    select: { email: true, fullName: true, role: true, id: true }
  });

  const project = await prisma.project.findFirst({
    select: { client: true, title: true }
  });

  let clientWithProject = null;
  if (project?.client) {
    clientWithProject = await prisma.user.findUnique({
      where: { id: project.client },
      select: { email: true, fullName: true, role: true }
    });
  }

  console.log("==============================");
  console.log("Freelancer Login Details:");
  if (freelancer) {
    console.log(`- Email: ${freelancer.email}`);
    console.log(`- Name: ${freelancer.fullName}`);
    console.log(`- Role: ${freelancer.role}`);
  } else {
    console.log("No freelancer found in DB.");
  }
  
  console.log("\nClient Login Details (Has Project):");
  if (clientWithProject) {
    console.log(`- Email: ${clientWithProject.email}`);
    console.log(`- Name: ${clientWithProject.fullName}`);
    console.log(`- Role: ${clientWithProject.role}`);
    console.log(`- Project Title: ${project?.title}`);
  } else {
    console.log("No client with a project found in DB.");
  }
  console.log("==============================");
}

getLogins().catch(console.error).finally(() => prisma.$disconnect());
