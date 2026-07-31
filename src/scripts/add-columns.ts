import { prisma } from "../config/database.js";

async function main() {
  console.log("Adding missing columns to MySQL database...");

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE users ADD COLUMN trial_ends_at DATETIME NULL AFTER status;`
    );
    console.log("Added trial_ends_at to users table");
  } catch (err: any) {
    console.log("trial_ends_at column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE freelancer_profiles ADD COLUMN verification_json TEXT NULL AFTER experience_level;`
    );
    console.log("Added verification_json to freelancer_profiles");
  } catch (err: any) {
    console.log("verification_json column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE freelancer_profiles ADD COLUMN portfolio_json TEXT NULL;`
    );
    console.log("Added portfolio_json to freelancer_profiles");
  } catch (err: any) {
    console.log("portfolio_json column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE subscription_plans ADD COLUMN original_amount DOUBLE NULL AFTER amount;`
    );
    console.log("Added original_amount to subscription_plans");
  } catch (err: any) {
    console.log("original_amount column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE subscription_plans ADD COLUMN saved_badge VARCHAR(255) NULL AFTER original_amount;`
    );
    console.log("Added saved_badge to subscription_plans");
  } catch (err: any) {
    console.log("saved_badge column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE projects ADD COLUMN budget_min DOUBLE NULL AFTER budget;`
    );
    console.log("Added budget_min to projects");
  } catch (err: any) {
    console.log("budget_min column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE projects ADD COLUMN budget_max DOUBLE NULL AFTER budget_min;`
    );
    console.log("Added budget_max to projects");
  } catch (err: any) {
    console.log("budget_max column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE wallet_transactions ADD COLUMN status VARCHAR(255) NULL DEFAULT 'completed';`
    );
    console.log("Added status to wallet_transactions");
  } catch (err: any) {
    console.log("wallet_transactions status column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE projects ADD COLUMN description TEXT NULL;`
    );
    console.log("Added description to projects");
  } catch (err: any) {
    console.log("projects description column note:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE projects ADD COLUMN work_mode VARCHAR(255) NULL;`
    );
    console.log("Added work_mode to projects");
  } catch (err: any) {
    console.log("projects work_mode column note:", err.message);
  }

  console.log("Database schema sync complete!");
  await prisma.$disconnect();
}

main().catch(console.error);
