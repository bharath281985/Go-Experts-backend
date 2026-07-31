import { prisma } from "../config/database.js";

async function main() {
  console.log("Checking startup ideas in database for founder fd-0 and all founders...");

  await prisma.startupIdea.updateMany({
    where: { founder: "fd-0" },
    data: {
      pitchDeck: "https://apiai.goexperts.in/uploads/pitch_deck.pdf",
      businessPlan: "https://apiai.goexperts.in/uploads/business_plan.pdf"
    }
  });

  // Also check all founders in database without an idea
  const founders = await prisma.user.findMany({
    where: { role: "founder", status: "active" },
    select: { id: true, fullName: true }
  });

  for (const f of founders) {
    const hasIdea = await prisma.startupIdea.findFirst({
      where: { founder: f.id, deletedAt: null }
    });
    if (!hasIdea) {
      await prisma.startupIdea.create({
        data: {
          id: `idea_${f.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
          founder: f.id,
          startup: `${f.fullName || 'Tech'} Ventures`,
          industry: "Technology",
          category: "SaaS",
          stage: "MVP",
          funding: 250000,
          equity: 5,
          visibility: "Public",
          status: "active"
        }
      });
      console.log(`[SUCCESS] Seeded startup idea for founder ${f.id}`);
    }
  }

  const existingBid = await prisma.investment.findFirst({
    where: { startup: "fd-0" }
  });

    try {
    await prisma.investment.create({
      data: {
        id: "bid_fd0_sample",
        startup: "fd-0",
        investor: "inv-0",
        offer: 250000,
        equity: 5,
        status: "Pending"
      }
    });
    console.log("[SUCCESS] Seeded investment bid for founder fd-0");
  } catch {
    console.log("[INFO] Sample investment bid already exists.");
  }

  console.log("Founder startup ideas seeding complete.");
}

main().catch(console.error);
