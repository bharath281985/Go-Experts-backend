import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXPERIENCE_LEVELS = [
  { label: "Entry Level (0-2 Yrs)", value: "Entry Level", sortOrder: 1 },
  { label: "Intermediate (2-5 Yrs)", value: "Intermediate", sortOrder: 2 },
  { label: "Senior Level (5-8 Yrs)", value: "Senior Level", sortOrder: 3 },
  { label: "Lead / Principal (8-12 Yrs)", value: "Lead / Principal", sortOrder: 4 },
  { label: "Executive / Director (12+ Yrs)", value: "Executive / Director", sortOrder: 5 },
];

function masterOptionId(value: string) {
  return `mo_experience_level_${value.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
}

async function main() {
  const activeValues = EXPERIENCE_LEVELS.map((level) => level.value);
  const activeLabels = EXPERIENCE_LEVELS.map((level) => level.label);

  await (prisma as any).masterOption.updateMany({
    where: {
      type: "experience_level",
      value: { notIn: activeValues },
    },
    data: { status: "inactive" },
  });

  await prisma.experienceLevel.updateMany({
    where: { name: { notIn: activeLabels } },
    data: { status: "inactive" },
  });

  for (const level of EXPERIENCE_LEVELS) {
    await (prisma as any).masterOption.updateMany({
      where: {
        type: "experience_level",
        value: level.value,
      },
      data: {
        label: level.label,
        sortOrder: level.sortOrder,
        status: "active",
      },
    });

    await (prisma as any).masterOption.upsert({
      where: { id: masterOptionId(level.value) },
      create: {
        id: masterOptionId(level.value),
        type: "experience_level",
        label: level.label,
        value: level.value,
        sortOrder: level.sortOrder,
        status: "active",
      },
      update: {
        label: level.label,
        value: level.value,
        sortOrder: level.sortOrder,
        status: "active",
      },
    });

    await prisma.experienceLevel.upsert({
      where: { name: level.label },
      create: {
        name: level.label,
        status: "active",
      },
      update: {
        status: "active",
      },
    });
  }

  console.log(`Seeded ${EXPERIENCE_LEVELS.length} experience levels.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
