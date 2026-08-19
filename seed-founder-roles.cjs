const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roles = ['Founder / CEO', 'Co-Founder & CTO', 'Co-Founder & COO', 'Co-Founder & CMO', 'Early Team Member', 'Advisor'];
  for (const opt of roles) {
    await prisma.masterOption.create({
      data: { type: 'founder_role', label: opt, value: opt, status: 'active' }
    }).catch(e => console.log('Already exists or error:', opt));
  }
  console.log('Seeding complete.');
}
main().finally(() => prisma.$disconnect());
