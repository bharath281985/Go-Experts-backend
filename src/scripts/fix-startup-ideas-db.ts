import { prisma } from "../config/database.js";

async function main() {
  console.log("Checking and syncing all database table columns...");

  const queries = [
    // conversations table missing columns
    `ALTER TABLE conversations ADD COLUMN user_a VARCHAR(255) NULL`,
    `ALTER TABLE conversations ADD COLUMN user_b VARCHAR(255) NULL`,
    `ALTER TABLE conversations ADD COLUMN project_id VARCHAR(255) NULL`,
    `ALTER TABLE conversations ADD COLUMN unread INT DEFAULT 0`,
    `ALTER TABLE conversations ADD COLUMN online TINYINT(1) DEFAULT 0`,
    `ALTER TABLE conversations ADD COLUMN typing TINYINT(1) DEFAULT 0`,

    // messages table missing columns
    `ALTER TABLE messages ADD COLUMN sender_id VARCHAR(255) NULL`,
    `ALTER TABLE messages ADD COLUMN attachment_url VARCHAR(500) NULL`,
    `ALTER TABLE messages ADD COLUMN read_at DATETIME NULL`,

    // startup_ideas table missing columns
    `ALTER TABLE startup_ideas ADD COLUMN pitch_deck VARCHAR(255) NULL`,
    `ALTER TABLE startup_ideas ADD COLUMN business_plan TEXT NULL`,
    `ALTER TABLE startup_ideas ADD COLUMN cover_url VARCHAR(255) NULL`,
    `ALTER TABLE startup_ideas ADD COLUMN interested_investors INT DEFAULT 0`,

    // users table missing columns
    `ALTER TABLE users ADD COLUMN is_verified TINYINT(1) DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN verified TINYINT(1) DEFAULT 0`,
  ];

  for (const q of queries) {
    try {
      await prisma.$executeRawUnsafe(q);
      console.log(`[SUCCESS] Executed: ${q}`);
    } catch (err: any) {
      console.log(`[INFO] Column sync outcome for "${q.slice(0, 45)}...":`, err?.message || err);
    }
  }

  console.log("Database schema columns synchronization complete.");
}

main().catch(console.error);
