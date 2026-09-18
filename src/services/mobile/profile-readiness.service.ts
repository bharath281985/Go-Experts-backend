import { resolveProfileCompletion } from './profile-completion.service.js';
import { prisma } from '../../config/database.js';
import { getVerificationStats } from '../../common/helpers/verification.js';

export class ActionRequirementsError extends Error {
  public code = "ACTION_REQUIREMENTS_MISSING";
  public action: string;
  public missing: any[];

  constructor(action: string, missing: any[]) {
    super(`Complete the required details before performing ${action}.`);
    this.name = 'ActionRequirementsError';
    this.action = action;
    this.missing = missing;
  }
}

export class PaymentReadinessError extends Error {
  public code = 'PAYMENT_PROFILE_REQUIREMENTS_MISSING';
  public profileCompletion: number;
  public kycStatus: string;
  public missing: string[];

  constructor(profileCompletion: number, kycStatus: string, missing: string[]) {
    const needsProfile = missing.includes('profileCompletion');
    const needsKyc = missing.includes('kyc');
    const message = needsProfile && needsKyc
      ? 'Please complete your profile to at least 70% and verify your KYC before continuing to payment.'
      : needsProfile
        ? 'Please complete your profile to at least 70% before continuing to payment.'
        : 'Please complete KYC verification before continuing to payment.';
    super(message);
    this.name = 'PaymentReadinessError';
    this.profileCompletion = profileCompletion;
    this.kycStatus = kycStatus;
    this.missing = missing;
  }
}

export const requireCapability = async (params: { userId: string, action: string }) => {
  const { userId, action } = params;
  
  const completion = await resolveProfileCompletion(userId);
  const capability = completion.capabilities[action];
  
  if (!capability) {
    // If capability is entirely undefined, fail safe by throwing.
    throw new ActionRequirementsError(action, []);
  }

  if (!capability.allowed) {
    throw new ActionRequirementsError(action, capability.missing || []);
  }

  return true;
};

export const requirePaymentReadiness = async (userId: string) => {
  const [completion, user] = await Promise.all([
    resolveProfileCompletion(userId),
    prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        freelancerProfile: true,
        clientProfile: true,
        founderProfile: true,
        investorProfile: true,
      },
    }),
  ]);

  const verification = user
    ? getVerificationStats(user)
    : { kycApproved: false, kycStatus: 'MISSING' };
  const profileCompletion = Number(completion.profileCompletion || 0);
  const kycVerified = verification.kycApproved === true;
  const missing: string[] = [];

  if (profileCompletion < 70) missing.push('profileCompletion');
  if (!kycVerified) missing.push('kyc');

  if (missing.length > 0) {
    throw new PaymentReadinessError(
      profileCompletion,
      String(verification.kycStatus || 'MISSING'),
      missing,
    );
  }

  return { profileCompletion, kycStatus: 'APPROVED' };
};
