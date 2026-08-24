import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function completeOnboarding() {
  const email = "fl.arjun0@goexperts.com";
  
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    console.log("User not found!");
    return;
  }

  await prisma.user.update({
    where: { email },
    data: {
      onboardingStatus: "COMPLETED",
      completionPercentage: 100,
      currentStep: null,
      nextStepKey: null
    }
  });

  console.log(`Successfully completed onboarding for ${email}`);
}

completeOnboarding().catch(console.error).finally(() => prisma.$disconnect());
