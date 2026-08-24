const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const u = await prisma.user.findFirst({ where: { email: 'olivia.harris67@goexperts.com' } });
    console.log('Olivia DB onboardingStatus:', u?.onboardingStatus);
}
main();
