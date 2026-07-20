const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Adding verification_json...");
    await prisma.$executeRawUnsafe(`ALTER TABLE freelancer_profiles ADD COLUMN verification_json TEXT;`);
    console.log("Added verification_json.");
  } catch (e) {
    console.log("verification_json might already exist: ", e.message);
  }

  try {
    console.log("Adding portfolio_json...");
    await prisma.$executeRawUnsafe(`ALTER TABLE freelancer_profiles ADD COLUMN portfolio_json TEXT;`);
    console.log("Added portfolio_json.");
  } catch (e) {
    console.log("portfolio_json might already exist: ", e.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
