import { PrismaClient } from '@prisma/client';
import { resolveProfileCompletion } from './src/services/mobile/profile-completion.service.ts';
import { getVerificationStats } from './src/common/helpers/verification.ts';

const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({ where: { email: 'vk4950362@gmail.com' } });
  if (!user) {
    console.log('User not found');
    return;
  }
  
  const completion = await resolveProfileCompletion(user.id);
  const kyc = await getVerificationStats(user.id);
  
  console.log('User:', user.email);
  console.log('User isVerified db flag:', user.isVerified);
  console.log('User verified db flag:', user.verified);
  console.log('User status db flag:', user.status);
  console.log('Profile Completion Score:', (completion as any).profileCompletion);
  console.log('Is Profile Complete?', completion.isProfileComplete);
  console.log('KYC Approved (Docs)?', kyc.kycApproved);
  console.log('Profile Approved (Flag)?', kyc.profileApproved);
  
  process.exit(0);
}

checkUser().catch(console.error);
