import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const india = await prisma.country.findFirst({ where: { name: 'India' } });
  if (!india) return;
  const cityOptions = await (prisma as any).masterOption.findMany({ where: { type: 'city' } });
  for (const c of cityOptions) {
    const existing = await (prisma as any).city.findFirst({ where: { name: c.label } });
    if (!existing) await (prisma as any).city.create({ data: { name: c.label, countryId: india.id, status: c.status || 'active' } });
  }
}
main().finally(() => prisma.());
