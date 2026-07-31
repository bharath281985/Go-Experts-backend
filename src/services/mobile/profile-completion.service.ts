import { prisma } from '../../config/database.js';

type ProfileCompletionResult = {
  profileCompletion: number;
  isProfileComplete: boolean;
};

const hasText = (value?: string | null) =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Derives onboarding completion from persisted user + role profile data.
 * Avatar is mandatory for a complete profile.
 */
export const resolveProfileCompletion = async (
  userId: string
): Promise<ProfileCompletionResult> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      freelancerProfile: true,
      clientProfile: true,
      investorProfile: true,
      founderProfile: true,
    },
  });

  if (!user) {
    return { profileCompletion: 0, isProfileComplete: false };
  }

  const hasRole = hasText(user.role);
  const hasCity = hasText(user.city);
  const hasBio = hasText(user.bio);
  const hasAvatar = hasText(user.avatarUrl);

  let hasRoleProfile = false;
  switch (user.role) {
    case 'freelancer':
      hasRoleProfile = hasText(user.freelancerProfile?.skills);
      break;
    case 'client':
      hasRoleProfile = hasText(user.clientProfile?.industry);
      break;
    case 'investor':
      hasRoleProfile = hasText(user.investorProfile?.focusAreas);
      break;
    case 'founder':
      hasRoleProfile = hasText(user.founderProfile?.industry);
      break;
    default:
      hasRoleProfile = false;
  }

  let score = 0;
  if (hasRole) score += 15;
  if (hasCity) score += 20;
  if (hasBio) score += 20;
  if (hasAvatar) score += 15;
  if (hasRoleProfile) score += 30;

  const isProfileComplete = hasCity && hasBio && hasAvatar && hasRoleProfile;
  if (isProfileComplete) {
    score = 100;
  }

  return {
    profileCompletion: Math.min(score, 100),
    isProfileComplete,
  };
};
