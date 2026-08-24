const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.project.findFirst({});
    console.log('Project title:', p.title);
    console.log('Project industryId:', p.industryId);
}
main();
