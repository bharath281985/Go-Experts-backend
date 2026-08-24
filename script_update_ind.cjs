const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.project.updateMany({
        where: { industryId: null },
        data: { industryId: 'Software & Technology' }
    });
    console.log('Updated projects to have industry: Software & Technology');
}
main();
