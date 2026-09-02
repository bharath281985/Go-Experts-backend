import { prisma } from "../config/database.js";

async function main() {
  console.log("Cleaning up dummy and auto-generated startup ideas from database...");

  // 1. Soft delete auto-generated placeholder startup records
  const result = await prisma.$executeRawUnsafe(`
    UPDATE startup_ideas 
    SET deleted_at = NOW(), status = 'deleted' 
    WHERE deleted_at IS NULL 
      AND (
        startup LIKE "%'s Startup" 
        OR startup LIKE "%’s Startup" 
        OR startup LIKE "% Ventures"
        OR startup = "" 
        OR startup IS NULL
      )
  `);

  console.log(`[SUCCESS] Soft-deleted ${result} auto-generated placeholder startup idea(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
