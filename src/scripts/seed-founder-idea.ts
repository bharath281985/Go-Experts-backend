import { prisma } from "../config/database.js";

async function main() {
  console.log("No auto-creation of startup ideas. Startups must be created explicitly by founders.");
}

main().catch(console.error);
