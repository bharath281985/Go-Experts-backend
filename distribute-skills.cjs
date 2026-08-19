const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Distributing skills across all industries...");

  const industries = await prisma.industry.findMany({ where: { status: 'active' } });
  if (industries.length === 0) {
    console.log("No active industries found.");
    return;
  }

  const skills = await prisma.skill.findMany();
  if (skills.length === 0) {
    console.log("No skills found in database.");
    return;
  }

  console.log(`Found ${industries.length} industries and ${skills.length} skills.`);

  // Divide skills roughly equally among all industries
  const skillsPerIndustry = Math.ceil(skills.length / industries.length);

  for (let i = 0; i < industries.length; i++) {
    const industry = industries[i];
    
    // Get a chunk of skills for this industry
    const startIdx = i * skillsPerIndustry;
    const endIdx = startIdx + skillsPerIndustry;
    const chunk = skills.slice(startIdx, endIdx);
    
    console.log(`Assigning ${chunk.length} skills to Industry: ${industry.name} (${industry.id})`);
    
    for (const skill of chunk) {
      await prisma.skill.update({
        where: { id: skill.id },
        data: { industry: industry.id }
      });
    }
  }

  console.log("Successfully distributed all skills across all industries!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
