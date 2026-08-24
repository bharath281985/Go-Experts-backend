const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.user.updateMany({
        where: { email: { in: ['rohit.white155@goexperts.com', 'olivia.harris67@goexperts.com', 'divya.anderson15@goexperts.com'] } },
        data: { onboardingStatus: 'COMPLETED' }
    });
    console.log('Updated onboarding status to COMPLETED');
}
main();
