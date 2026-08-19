const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const data = [
    { typeFilter: 'team_size', options: ['Just me', '2-10', '11-50', '51-200', '201+'] },
    { typeFilter: 'startup_stage', options: ['Idea/Concept', 'MVP/Prototype', 'Early Revenue', 'Growth/Scaling', 'Mature'] },
    { typeFilter: 'founder_goal', options: ['Find Co-Founder', 'Raise Capital', 'Hire Talent', 'Find Mentorship', 'Networking'] }
  ];

  for (const group of data) {
    for (const opt of group.options) {
      await prisma.masterOption.create({
        data: {
          category: group.typeFilter,
          label: opt,
          value: opt,
          isActive: true
        }
      }).catch(e => console.log('Already exists or error:', opt));
    }
  }
  console.log('Seeding complete.');
}
main().finally(() => prisma.$disconnect());
