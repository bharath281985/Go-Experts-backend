import { prisma } from '../../config/database.js';

const hasText = (value?: string | null) =>
  typeof value === 'string' && value.trim().length > 0;

const hasNumber = (value?: number | null) =>
  typeof value === 'number' && !isNaN(value);

// ─── Section checkers ──────────────────────────────────────────────────────────

function checkFreelancerSections(user: any) {
  const fp = user.freelancerProfile;
  const sections: Record<string, boolean> = {
    personal_info:       hasText(user.fullName) && hasText(user.email),
    professional_info:   hasText(user.bio) && (hasText(fp?.titleHeadline) || hasText(user.bio)),
    skills:              hasText(fp?.skills),
    experience:          hasText(fp?.experience) || hasNumber(fp?.hourlyRate),
    portfolio:           hasText(fp?.portfolioUrl) || hasText(fp?.linkedInUrl) || hasText(fp?.githubUrl) || hasText(fp?.dribbbleUrl),
    avatar:              hasText(user.avatarUrl),
    location:            hasText(user.city) || hasText(user.country),
    resume:              hasText(fp?.resumeUrl),
  };
  return sections;
}

function checkClientSections(user: any) {
  const cp = user.clientProfile;
  const sections: Record<string, boolean> = {
    personal_info:   hasText(user.fullName) && hasText(user.email),
    company_info:    hasText(cp?.company) || hasText(cp?.industry),
    project_details: hasText(cp?.hiringGoal) || hasText(cp?.projectHireBudget),
    avatar:          hasText(user.avatarUrl),
    location:        hasText(user.city) || hasText(user.country),
  };
  return sections;
}

function checkInvestorSections(user: any) {
  const ip = user.investorProfile;
  const sections: Record<string, boolean> = {
    personal_info:  hasText(user.fullName) && hasText(user.email),
    firm_info:      hasText(ip?.firm) || hasText(ip?.investorType),
    focus_areas:    hasText(ip?.focusAreas),
    ticket_size:    hasNumber(ip?.ticketMin) || hasNumber(ip?.ticketMax),
    avatar:         hasText(user.avatarUrl),
    location:       hasText(user.city) || hasText(user.country),
  };
  return sections;
}

function checkFounderSections(user: any) {
  const fop = user.founderProfile;
  const sections: Record<string, boolean> = {
    personal_info:   hasText(user.fullName) && hasText(user.email),
    startup_info:    hasText(fop?.startupName) || hasText(fop?.industry),
    pitch:           hasText(fop?.pitch),
    funding_info:    hasText(fop?.stage) || hasNumber(fop?.raised) || hasNumber(fop?.targetRaise),
    avatar:          hasText(user.avatarUrl),
    location:        hasText(user.city) || hasText(user.country),
  };
  return sections;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export type ProfileCompletionResult = {
  profileCompletion: number;
  isProfileComplete: boolean;
  completedSteps: string[];
  pendingSteps: string[];
  totalSteps: number;
  completedCount: number;
};

/**
 * Derives real onboarding/profile completion from persisted user + role profile data.
 * Returns step-by-step breakdown so the frontend can show exactly what's missing.
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

  const fallback: ProfileCompletionResult = {
    profileCompletion: 0,
    isProfileComplete: false,
    completedSteps: [],
    pendingSteps: [],
    totalSteps: 0,
    completedCount: 0,
  };

  if (!user) return fallback;

  let sections: Record<string, boolean>;

  switch (user.role) {
    case 'freelancer': sections = checkFreelancerSections(user); break;
    case 'client':     sections = checkClientSections(user);     break;
    case 'investor':   sections = checkInvestorSections(user);   break;
    case 'founder':    sections = checkFounderSections(user);    break;
    default:           sections = { personal_info: hasText(user.fullName) && hasText(user.email) };
  }

  const allSteps      = Object.keys(sections);
  const completedSteps = allSteps.filter(k => sections[k]);
  const pendingSteps   = allSteps.filter(k => !sections[k]);
  const totalSteps     = allSteps.length;
  const completedCount = completedSteps.length;

  const profileCompletion  = Math.round((completedCount / totalSteps) * 100);
  const isProfileComplete  = pendingSteps.length === 0;

  return {
    profileCompletion,
    isProfileComplete,
    completedSteps,
    pendingSteps,
    totalSteps,
    completedCount,
  };
};
