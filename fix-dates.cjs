const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fixing invalid dates in database...');
  try {
    // This raw query fixes the '0000-00-00' date issue in MySQL 
    // by setting invalid updated_at values to the current timestamp.
    await prisma.$executeRawUnsafe(`
      UPDATE master_options 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE updated_at < '1970-01-01' OR updated_at IS NULL
    `);
    console.log('Successfully fixed invalid dates in master_options.');
  } catch (error) {
    console.error('Error fixing dates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
