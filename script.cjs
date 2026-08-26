const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const value = JSON.stringify({
    "Founder": "#10b981",
    "Freelancer": "#8b5cf6",
    "Investor": "#3b82f6",
    "Client": "#f59e0b"
  });

  await prisma.setting.upsert({
    where: { key: "settings:industry_colors" },
    update: { value },
    create: {
      key: "settings:industry_colors",
      value: value,
      category: "branding"
    }
  });
  console.log("Database reset!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
