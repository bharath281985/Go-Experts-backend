import { PrismaClient } from '@prisma/client';
import { activateFreeTrialOnKycApproval } from './src/services/subscription/free-trial.service.js';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'sneha.singh299@goexperts.com' }, include: { subscriptions: true } });
  if (!user) {
    console.log('User not found');
    return;
  }
  console.log('Found user:', user.id, user.verified);
  console.log('Subscriptions:', user.subscriptions.length);
  
  if (user.subscriptions.length === 0) {
    console.log('Activating free trial manually...');
    const result = await activateFreeTrialOnKycApproval(user.id);
    console.log('Result:', JSON.stringify(result, null, 2));
  } else {
    console.log('First sub:', user.subscriptions[0]);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
