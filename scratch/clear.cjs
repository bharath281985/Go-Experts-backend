const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$executeRawUnsafe('DELETE FROM referral_campaigns').then(() => prisma.$disconnect());
