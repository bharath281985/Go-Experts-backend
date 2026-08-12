const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const check = await prisma.skill.findUnique({
    where: { id: '7344b40a-950c-4e65-894c-5f9582389b85' }
  });
  console.log('Skill:', check);

  const ind = await prisma.industry.findUnique({
    where: { id: '7344b40a-950c-4e65-894c-5f9582389b85' }
  });
  console.log('Industry:', ind);
  
  const allSkills = await prisma.skill.findMany();
  console.log('Total Skills:', allSkills.length);
}

main().finally(() => prisma.$disconnect());
