const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const masterOptionsData = [
    { type: 'budget_range', options: ['Under $1,000', '$1k - $5k', '$5k - $20k', '$20k+'] },
    { type: 'company_size', options: ['1-10 employees', '11-50 employees', '51-200 employees', '200+ employees'] },
    { type: 'hiring_goal', options: ['Hire a single freelancer', 'Hire a full team', 'Ongoing project support', 'Not sure yet'] },
    { type: 'team_size', options: ['Just me', '2-10', '11-50', '51-200', '201+'] },
    { type: 'investor_type', options: ['Angel Investor', 'Venture Capital', 'Syndicate', 'Family Office', 'Corporate Investor'] },
    { type: 'accredited_status', options: ['Yes, I am accredited', 'No, I am not accredited'] },
    { type: 'investment_stage', options: ['Pre-Seed', 'Seed', 'Series A', 'Series B+'] },
    { type: 'startup_stage', options: ['Idea/Concept', 'MVP/Prototype', 'Early Revenue', 'Growth/Scaling', 'Mature'] },
    { type: 'founder_goal', options: ['Find Co-Founder', 'Raise Capital', 'Hire Talent', 'Find Mentorship', 'Networking'] },
    { type: 'founder_role', options: ['Founder / CEO', 'Co-Founder & CTO', 'Co-Founder & COO', 'Co-Founder & CMO', 'Early Team Member', 'Advisor'] }
  ];

  console.log('Seeding Master Options...');
  for (const group of masterOptionsData) {
    let order = 1;
    for (const opt of group.options) {
      const exists = await prisma.masterOption.findFirst({ where: { type: group.type, value: opt } });
      if (!exists) {
        await prisma.masterOption.create({
          data: { type: group.type, label: opt, value: opt, status: 'active', sortOrder: order }
        });
        console.log(`Created ${group.type}: ${opt}`);
      }
      order++;
    }
  }

  console.log('Seeding Experience Levels...');
  const expLevels = ['Entry Level (0-2 years)', 'Intermediate (3-5 years)', 'Expert (5+ years)'];
  for (const exp of expLevels) {
    const exists = await prisma.experienceLevel.findFirst({ where: { name: exp } });
    if (!exists) {
      await prisma.experienceLevel.create({ data: { name: exp } });
      console.log(`Created experience_level: ${exp}`);
    }
  }

  console.log('All signup data seeded completely.');
}

main().finally(() => prisma.$disconnect());
