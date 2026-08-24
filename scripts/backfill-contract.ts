import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const proposalId = '633c442c-45da-45b1-a2a8-a59758095c7a';
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }});
  
  if (!proposal) return console.log("Proposal not found");
  
  const existingContract = await prisma.contract.findFirst({
    where: { proposalId }
  });

  if (!existingContract) {
    const contract = await prisma.contract.create({
      data: {
        contractNumber: `CTR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        projectId: proposal.projectId,
        clientId: '010adca1-2198-4e52-a4fd-3363fbca6497', // Nisha's ID
        freelancerId: proposal.freelancerId,
        proposalId: proposal.id,
        status: "pending_acceptance",
      }
    });
    console.log("Created contract for proposal:", contract.id);
  } else {
    console.log("Contract already exists:", existingContract.id);
  }
}

main().finally(() => prisma.$disconnect());
