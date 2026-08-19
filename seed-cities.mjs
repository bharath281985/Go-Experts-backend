import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const india = await prisma.country.findFirst({ where: { name: 'India' } });
  if (!india) return;
  const cityNames = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur'];
  for (const c of cityNames) {
    const existing = await prisma.city.findFirst({ where: { name: c } });
    if (!existing) await prisma.city.create({ data: { name: c, countryId: india.id, status: 'active' } });
  }
}
main().finally(() => { prisma.$disconnect() });
