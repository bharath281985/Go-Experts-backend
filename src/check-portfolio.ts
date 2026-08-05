import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'freelancer' },
    orderBy: { createdAt: 'desc' },
    include: { freelancerProfile: true }
  });

  if (!user) {
    console.log("No freelancer found in DB!");
    return;
  }

  const setting = await prisma.setting.findUnique({
    where: { key: `freelancer_portfolio:${user.id}` }
  });

  console.log("=================================");
  console.log("LATEST FREELANCER:", user.email);
  console.log("ID:", user.id);
  console.log("REGISTRATION DATA:", JSON.stringify(user.registrationData, null, 2));
  console.log("PORTFOLIO JSON (Profile):", user.freelancerProfile?.portfolioJson);
  console.log("PORTFOLIO JSON (Setting):", setting?.value);
  console.log("=================================");
}

main().finally(() => prisma.$disconnect());
