import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const proposal = await prisma.proposal.findFirst({
    where: { id: "633c442c-45da-45b1-a2a8-a59758095c7a" },
    include: { project: true },
  });
  console.log("Proposal status:", proposal?.status);
  console.log("project.client field:", (proposal?.project as any)?.client);
  console.log("project.clientId field:", (proposal?.project as any)?.clientId);
  
  // Check Nisha's clientProfile
  const clientProfile = await prisma.clientProfile.findUnique({ 
    where: { userId: "010adca1-2198-4e52-a4fd-3363fbca6497" } 
  });
  console.log("Nisha clientProfile.id:", clientProfile?.id);
}

main().finally(() => prisma.$disconnect());
