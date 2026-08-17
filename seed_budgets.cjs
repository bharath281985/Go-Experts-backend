const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function seedBudgets() {
  const budgets = [
    { label: 'Less than $1,000', value: '0-1000', min: 0, max: 1000, sortOrder: 1 },
    { label: '$1,000 - $5,000', value: '1000-5000', min: 1000, max: 5000, sortOrder: 2 },
    { label: '$5,000 - $10,000', value: '5000-10000', min: 5000, max: 10000, sortOrder: 3 },
    { label: '$10,000 - $50,000', value: '10000-50000', min: 10000, max: 50000, sortOrder: 4 },
    { label: '$50,000+', value: '50000+', min: 50000, max: null, sortOrder: 5 }
  ];
  for (const b of budgets) {
    await prisma.masterOption.create({
      data: { type: 'budget_range', label: b.label, value: b.value, min: b.min, max: b.max, sortOrder: b.sortOrder }
    });
  }
  console.log('Done');
}
seedBudgets().catch(console.error).finally(() => prisma.$disconnect());
