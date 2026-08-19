import { PrismaClient } from '@prisma/client';
import { activateFreeTrialOnKycApproval } from './src/services/subscription/free-trial.service.js';

const prisma = new PrismaClient();

async function main() {
  const userId = 'fceeead0-fbca-4bfa-9a58-1d1213d5ac32'; // vinod's id
  console.log(`Triggering approval for user ${userId}...`);
  const result = await activateFreeTrialOnKycApproval(userId);
  console.log('Result:', result);
}
main().catch(console.error).finally(() => prisma.$disconnect());
