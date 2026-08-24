const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const u = await prisma.user.findFirst({ where: { email: 'rohit.white155@goexperts.com' } });
    console.log('Onboarding Status:', u?.onboardingStatus);
}
main();
