const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

const seedData = [
  { type: 'hiring_goal', label: 'Hire freelancers for short-term projects', value: 'Hire freelancers for projects', sortOrder: 1 },
  { type: 'hiring_goal', label: 'Hire dedicated long-term talent', value: 'Hire dedicated long-term talent', sortOrder: 2 },
  { type: 'hiring_goal', label: 'Build an entire product team', value: 'Build an entire product team', sortOrder: 3 },
  { type: 'hiring_goal', label: 'Consulting and Strategic Advisory', value: 'Consulting and Advisory', sortOrder: 4 },
  { type: 'company_size', label: '1-10 employees', value: '1-10 employees', sortOrder: 1 },
  { type: 'company_size', label: '11-50 employees', value: '11-50 employees', sortOrder: 2 },
  { type: 'company_size', label: '51-200 employees', value: '51-200 employees', sortOrder: 3 },
  { type: 'company_size', label: '200+ employees', value: '200+ employees', sortOrder: 4 },
  { type: 'budget_range', label: 'Under 80,000', value: 'Under 1000', sortOrder: 1 },
  { type: 'budget_range', label: '80,000 - 4L', value: '1k-5k', sortOrder: 2 },
  { type: 'budget_range', label: '4L - 16L', value: '5k-20k', sortOrder: 3 },
  { type: 'budget_range', label: '16L+', value: '20k+', sortOrder: 4 },
  { type: 'investor_type', label: 'Angel Investor', value: 'Angel Investor', sortOrder: 1 },
  { type: 'investor_type', label: 'Venture Capitalist (VC)', value: 'Venture Capitalist (VC)', sortOrder: 2 },
  { type: 'investor_type', label: 'Family Office', value: 'Family Office', sortOrder: 3 },
  { type: 'investor_type', label: 'Syndicate Lead', value: 'Syndicate Lead', sortOrder: 4 },
  { type: 'investor_type', label: 'Corporate VC', value: 'Corporate VC', sortOrder: 5 },
  { type: 'accredited_status', label: 'Yes, I am an Accredited Investor', value: 'Yes', sortOrder: 1 },
  { type: 'accredited_status', label: 'No / Under evaluation', value: 'No', sortOrder: 2 },
  { type: 'investment_stage', label: 'Idea / Pre-seed', value: 'Idea / Pre-seed', sortOrder: 1 },
  { type: 'investment_stage', label: 'Seed', value: 'Seed', sortOrder: 2 },
  { type: 'investment_stage', label: 'Early Stage (Series A/B)', value: 'Early Stage (Series A/B)', sortOrder: 3 },
  { type: 'investment_stage', label: 'Growth Stage (Series C+)', value: 'Growth Stage (Series C+)', sortOrder: 4 },
];

async function seed() {
  let created = 0;
  for (const d of seedData) {
    const existing = await prisma.masterOption.findFirst({ where: { type: d.type, value: d.value } });
    if (!existing) {
      await prisma.masterOption.create({ data: { ...d, status: 'active' } });
      created++;
    }
  }
  console.log('Seeded', created, 'new master options');
  await prisma['\']();
}
seed().catch(e => { console.error(e); process.exit(1); });
