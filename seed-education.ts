import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const educationLevels = [
  "High School / GED",
  "Associate Degree",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctorate (PhD)",
  "Professional Certificate",
  "Bootcamp Graduate",
  "Other"
];

async function main() {
  let sortOrder = 1;
  for (const level of educationLevels) {
    const existing = await prisma.masterOption.findFirst({
      where: { type: "education_level", label: level }
    });
    if (!existing) {
      await prisma.masterOption.create({
        data: {
          type: "education_level",
          label: level,
          value: level,
          sortOrder: sortOrder++
        }
      });
      console.log(`Added: ${level}`);
    }
  }
  console.log("Education levels seeded.");
}

main().catch(console.error).finally(() => prisma.$disconnect());