const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = '0021e27c-1aa1-4d2a-8bb8-abe0dd145e6b';
  
  await prisma.project.update({
    where: { id: projectId },
    data: {
      description: "We are looking for an experienced full-stack developer to build our next generation e-commerce platform.",
      rawDetails: {
        objectives: "1. Increase conversion rate by 20%\n2. Reduce cart abandonment\n3. Improve mobile responsiveness",
        businessGoals: "Expand our digital presence into 3 new markets by Q4.",
        skills: "React, Node.js, Prisma, TailwindCSS",
        deliverables: "- Figma designs converted to React components\n- Integrated Stripe payments\n- Admin dashboard for inventory management",
        pricingModel: "Fixed",
        paymentTerms: "50% upfront, 50% on completion",
        languages: "English"
      }
    }
  });
  console.log("Database updated successfully");
}

main().catch(console.error).finally(() => prisma.$disconnect());
