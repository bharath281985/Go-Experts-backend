import { prisma } from '../../config/database.js';

const hasText = (value?: string | null) =>
  typeof value === 'string' && value.trim().length > 0;

const hasNumber = (value?: number | null) =>
  typeof value === 'number' && !isNaN(value);

const hasArray = (value?: any | null) =>
  Array.isArray(value) && value.length > 0;

export type ProfileLevel = 'INCOMPLETE' | 'BASIC' | 'DEVELOPING' | 'NEARLY_READY' | 'READY' | 'STRONG' | 'COMPLETE';

export type ProfileCompletionResult = {
  profileCompletion: number;
  profileLevel: ProfileLevel;
  operationalReady: boolean;
  requirements: {
    core: { complete: boolean; missing: { key: string; label: string }[] };
    recommended: { missing: { key: string; label: string }[] };
  };
  verification: {
    email: string;
    phone: string;
    identity: string;
  };
  capabilities: Record<string, { allowed: boolean; reason?: string; missing?: { key: string; label: string; route?: string }[] }>;
  
  // Backward compatibility fields for mobile apps
  isProfileComplete: boolean;
  completedSteps: string[];
  pendingSteps: string[];
  totalSteps: number;
  completedCount: number;
};

function getProfileLevel(percentage: number): ProfileLevel {
  if (percentage === 100) return 'COMPLETE';
  if (percentage >= 90) return 'STRONG';
  if (percentage >= 80) return 'READY';
  if (percentage >= 65) return 'NEARLY_READY';
  if (percentage >= 50) return 'DEVELOPING';
  if (percentage >= 30) return 'BASIC';
  return 'INCOMPLETE';
}

function evaluateFreelancer(user: any, fp: any) {
  const fields = {
    fullName: hasText(user.fullName),
    email: hasText(user.email),
    phone: hasText(user.phone),
    title: hasText(fp?.titleHeadline),
    bio: hasText(user.bio),
    category: hasText(fp?.industry),
    skills: hasText(fp?.skills),
    experience: hasText(fp?.experience) || hasText(fp?.experienceLevel),
    country: hasText(user.country),
    city: hasText(user.city),
    availability: hasText(fp?.availability),
    rate: hasNumber(fp?.hourlyRate),
    portfolio: hasText(fp?.portfolioUrl) || hasText(fp?.githubUrl) || hasText(fp?.dribbbleUrl),
    resume: hasText(fp?.resumeUrl),
    certifications: hasText(fp?.certifications),
    linkedin: hasText(fp?.linkedInUrl),
    avatar: hasText(user.avatarUrl),
  };

  const core = [
    { key: 'fullName', label: 'Full Name', valid: fields.fullName, sectionKey: 'personal' },
    { key: 'email', label: 'Email Address', valid: fields.email, sectionKey: 'personal' },
    { key: 'title', label: 'Professional Title', valid: fields.title, sectionKey: 'professional' },
    { key: 'bio', label: 'Professional Bio', valid: fields.bio, sectionKey: 'professional' },
    { key: 'skills', label: 'Required Skills', valid: fields.skills, sectionKey: 'skills' },
    { key: 'experience', label: 'Experience Level', valid: fields.experience, sectionKey: 'professional' },
    { key: 'country', label: 'Country', valid: fields.country, sectionKey: 'location' },
    { key: 'city', label: 'City', valid: fields.city, sectionKey: 'location' },
    { key: 'avatar', label: 'Profile Picture', valid: fields.avatar, sectionKey: 'personal' },
  ];

  const recommended = [
    { key: 'portfolio', label: 'Portfolio / Work Samples', valid: fields.portfolio, sectionKey: 'portfolio' },
    { key: 'resume', label: 'Resume', valid: fields.resume, sectionKey: 'resume' },
    { key: 'linkedin', label: 'LinkedIn Profile', valid: fields.linkedin, sectionKey: 'social' },
  ];

  const weights = {
    identity: 15,
    professional: 20,
    skills: 20,
    rate: 15,
    location: 10,
    enhancements: 20,
  };

  let score = 0;
  if (fields.fullName && fields.email && fields.avatar) score += weights.identity;
  if (fields.title && fields.bio && fields.experience) score += weights.professional;
  if (fields.skills) score += weights.skills;
  if (fields.rate || fields.availability) score += weights.rate;
  if (fields.country && fields.city) score += weights.location;
  if (fields.portfolio || fields.resume || fields.linkedin) score += weights.enhancements;

  const missingCore = core.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label, sectionKey: c.sectionKey }));
  const missingRecommended = recommended.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label, sectionKey: c.sectionKey }));

  const capabilities: Record<string, any> = {
    browseProjects: { allowed: true },
    submitProposal: { allowed: true, missing: [] }
  };

  const proposalMissing = [];
  if (!fields.availability) proposalMissing.push({ key: 'availability', label: 'Availability', sectionKey: 'availability' });
  if (!fields.rate) proposalMissing.push({ key: 'hourlyRate', label: 'Hourly Rate', sectionKey: 'rates' });
  if (!fields.skills) proposalMissing.push({ key: 'skills', label: 'Skills', sectionKey: 'skills' });
  
  if (proposalMissing.length > 0) {
    capabilities.submitProposal = {
      allowed: false,
      reason: 'PROFILE_REQUIREMENTS_MISSING',
      missing: proposalMissing
    };
  }

  const legacySections = {
    personal_info: fields.fullName && fields.email,
    professional_info: fields.bio && fields.title,
    skills: fields.skills,
    experience: fields.experience || fields.rate,
    portfolio: fields.portfolio,
    avatar: fields.avatar,
    location: fields.city || fields.country,
    resume: fields.resume,
  };

  return { score, missingCore, missingRecommended, capabilities, legacySections };
}

function evaluateClient(user: any, cp: any) {
  const fields = {
    fullName: hasText(user.fullName),
    email: hasText(user.email),
    phone: hasText(user.phone),
    company: hasText(cp?.company),
    industry: hasText(cp?.industry),
    country: hasText(user.country),
    city: hasText(user.city),
    avatar: hasText(user.avatarUrl),
    hiringGoal: hasText(cp?.hiringGoal),
    projectHireBudget: hasText(cp?.projectHireBudget) || hasNumber(cp?.projectHireBudget),
  };

  const core = [
    { key: 'fullName', label: 'Full Name', valid: fields.fullName },
    { key: 'email', label: 'Email Address', valid: fields.email },
    { key: 'country', label: 'Country', valid: fields.country },
    { key: 'city', label: 'City', valid: fields.city },
    { key: 'avatar', label: 'Profile Picture', valid: fields.avatar },
  ];

  const recommended = [
    { key: 'company', label: 'Company Name', valid: fields.company },
    { key: 'industry', label: 'Industry', valid: fields.industry },
  ];

  let score = 0;
  if (fields.fullName && fields.email && fields.avatar) score += 30;
  if (fields.company || fields.industry) score += 30;
  if (fields.country && fields.city) score += 20;
  if (fields.hiringGoal || fields.projectHireBudget) score += 20;

  const missingCore = core.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label }));
  const missingRecommended = recommended.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label }));

  const capabilities: Record<string, any> = {
    browseFreelancers: { allowed: true },
    publishProject: { allowed: true, missing: [] },
  };

  const publishMissing = [];
  if (!fields.country) publishMissing.push({ key: 'location', label: 'Location Details', sectionKey: 'location' });
  if (!fields.industry) publishMissing.push({ key: 'industry', label: 'Industry', sectionKey: 'company' });
  
  if (publishMissing.length > 0) {
    capabilities.publishProject = {
      allowed: false,
      reason: 'PROFILE_REQUIREMENTS_MISSING',
      missing: publishMissing
    };
  }

  const legacySections = {
    personal_info: fields.fullName && fields.email,
    company_info: fields.company || fields.industry,
    project_details: fields.hiringGoal || fields.projectHireBudget,
    avatar: fields.avatar,
    location: fields.city || fields.country,
  };

  return { score, missingCore, missingRecommended, capabilities, legacySections };
}

function evaluateInvestor(user: any, ip: any) {
  const fields = {
    fullName: hasText(user.fullName),
    email: hasText(user.email),
    phone: hasText(user.phone),
    investorType: hasText(ip?.investorType),
    firm: hasText(ip?.firm),
    focusAreas: hasText(ip?.focusAreas),
    ticketMin: hasNumber(ip?.ticketMin) || hasText(ip?.ticketMin),
    country: hasText(user.country),
    city: hasText(user.city),
    avatar: hasText(user.avatarUrl),
  };

  const isIndividual = ip?.investorType === 'Angel Investor' || ip?.investorType === 'Individual';

  const core = [
    { key: 'fullName', label: 'Full Name', valid: fields.fullName },
    { key: 'email', label: 'Email Address', valid: fields.email },
    { key: 'investorType', label: 'Investor Type', valid: fields.investorType },
    { key: 'focusAreas', label: 'Preferred Industries', valid: fields.focusAreas },
    { key: 'avatar', label: 'Profile Picture', valid: fields.avatar },
  ];

  const recommended = [
    { key: 'ticketMin', label: 'Investment Range', valid: fields.ticketMin },
    { key: 'country', label: 'Country', valid: fields.country },
  ];

  if (!isIndividual) {
    core.push({ key: 'firm', label: 'Firm Name', valid: fields.firm });
  }

  let maxScore = isIndividual ? 80 : 100;
  let earnedScore = 0;
  
  if (fields.fullName && fields.email && fields.avatar) earnedScore += 30;
  if (fields.investorType && fields.focusAreas) earnedScore += 30;
  if (fields.ticketMin) earnedScore += 20;
  if (!isIndividual && fields.firm) earnedScore += 20;
  
  let score = Math.round((earnedScore / maxScore) * 100);
  if (score > 100) score = 100;

  const missingCore = core.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label }));
  const missingRecommended = recommended.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label }));

  const capabilities: Record<string, any> = {
    browseStartups: { allowed: true },
    expressInterest: { allowed: true, missing: [] },
  };

  const interestMissing = [];
  if (!fields.investorType) interestMissing.push({ key: 'investorType', label: 'Investor Type', sectionKey: 'firm' });
  if (!fields.focusAreas) interestMissing.push({ key: 'focusAreas', label: 'Preferred Industries', sectionKey: 'focus' });
  if (!isIndividual && !fields.firm) interestMissing.push({ key: 'firm', label: 'Firm Name', sectionKey: 'firm' });
  
  if (interestMissing.length > 0) {
    capabilities.expressInterest = {
      allowed: false,
      reason: 'PROFILE_REQUIREMENTS_MISSING',
      missing: interestMissing
    };
  }

  const legacySections = {
    personal_info: fields.fullName && fields.email,
    firm_info: fields.firm || fields.investorType,
    focus_areas: fields.focusAreas,
    ticket_size: fields.ticketMin,
    avatar: fields.avatar,
    location: fields.city || fields.country,
  };

  return { score, missingCore, missingRecommended, capabilities, legacySections };
}

function evaluateFounder(user: any, fp: any) {
  const fields = {
    fullName: hasText(user.fullName),
    email: hasText(user.email),
    phone: hasText(user.phone),
    startupName: hasText(fp?.startupName),
    industry: hasText(fp?.industry),
    pitch: hasText(fp?.pitch),
    stage: hasText(fp?.stage),
    targetRaise: hasNumber(fp?.targetRaise) || hasText(fp?.targetRaise),
    country: hasText(user.country),
    city: hasText(user.city),
    avatar: hasText(user.avatarUrl),
  };

  const seekingFunding = true; // Placeholder for future logic based on intents

  const core = [
    { key: 'fullName', label: 'Full Name', valid: fields.fullName },
    { key: 'email', label: 'Email Address', valid: fields.email },
    { key: 'startupName', label: 'Startup Name', valid: fields.startupName },
    { key: 'industry', label: 'Industry', valid: fields.industry },
    { key: 'pitch', label: 'Short Pitch', valid: fields.pitch },
    { key: 'stage', label: 'Business Stage', valid: fields.stage },
    { key: 'avatar', label: 'Profile Picture', valid: fields.avatar },
  ];

  if (seekingFunding) {
    core.push({ key: 'targetRaise', label: 'Target Raise', valid: fields.targetRaise });
  }

  const recommended = [
    { key: 'country', label: 'Location', valid: fields.country || fields.city },
  ];

  let maxScore = seekingFunding ? 100 : 85;
  let earnedScore = 0;
  
  if (fields.fullName && fields.email && fields.avatar) earnedScore += 25;
  if (fields.startupName && fields.industry) earnedScore += 25;
  if (fields.pitch && fields.stage) earnedScore += 20;
  if (fields.country || fields.city) earnedScore += 15;
  if (seekingFunding && fields.targetRaise) earnedScore += 15;
  
  let score = Math.round((earnedScore / maxScore) * 100);
  if (score > 100) score = 100;

  const missingCore = core.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label, sectionKey: c.key === 'targetRaise' ? 'funding' : 'startup' }));
  const missingRecommended = recommended.filter(c => !c.valid).map(c => ({ key: c.key, label: c.label, sectionKey: 'startup' }));

  const capabilities: Record<string, any> = {
    browseInvestors: { allowed: true },
    contactInvestor: { allowed: true, missing: [] },
  };

  const contactMissing = [];
  if (!fields.startupName) contactMissing.push({ key: 'startupName', label: 'Startup Name', sectionKey: 'startup' });
  if (!fields.pitch) contactMissing.push({ key: 'pitch', label: 'Short Pitch', sectionKey: 'startup' });
  if (seekingFunding && !fields.targetRaise) contactMissing.push({ key: 'targetRaise', label: 'Target Raise', sectionKey: 'funding' });
  
  if (contactMissing.length > 0) {
    capabilities.contactInvestor = {
      allowed: false,
      reason: 'PROFILE_REQUIREMENTS_MISSING',
      missing: contactMissing
    };
  }

  const legacySections = {
    personal_info: fields.fullName && fields.email,
    startup_info: fields.startupName || fields.industry,
    pitch: fields.pitch,
    funding_info: fields.stage || fields.targetRaise,
    avatar: fields.avatar,
    location: fields.city || fields.country,
  };

  return { score, missingCore, missingRecommended, capabilities, legacySections };
}

/**
 * Derives real onboarding/profile completion and operational readiness.
 * Supports legacy mobile fields alongside the new capabilities engine.
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
    profileLevel: 'INCOMPLETE',
    operationalReady: false,
    requirements: { core: { complete: false, missing: [] }, recommended: { missing: [] } },
    verification: { email: 'PENDING', phone: 'PENDING', identity: 'PENDING' },
    capabilities: {},
    isProfileComplete: false,
    completedSteps: [],
    pendingSteps: [],
    totalSteps: 0,
    completedCount: 0,
  };

  if (!user) return fallback;

  let evaluation;
  switch (user.role) {
    case 'freelancer': evaluation = evaluateFreelancer(user, user.freelancerProfile); break;
    case 'client':     evaluation = evaluateClient(user, user.clientProfile); break;
    case 'investor':   evaluation = evaluateInvestor(user, user.investorProfile); break;
    case 'founder':    evaluation = evaluateFounder(user, user.founderProfile); break;
    default:           evaluation = { score: 0, missingCore: [], missingRecommended: [], capabilities: {}, legacySections: {} };
  }

  const allSteps      = Object.keys(evaluation.legacySections);
  const completedSteps = allSteps.filter(k => (evaluation.legacySections as any)[k]);
  const pendingSteps   = allSteps.filter(k => !(evaluation.legacySections as any)[k]);
  const totalSteps     = allSteps.length;
  const completedCount = completedSteps.length;
  const legacyIsComplete = pendingSteps.length === 0;

  const isCoreComplete = evaluation.missingCore.length === 0;
  const operationalReady = evaluation.score >= 80 && isCoreComplete;

  return {
    profileCompletion: evaluation.score,
    profileLevel: getProfileLevel(evaluation.score),
    operationalReady,
    requirements: {
      core: {
        complete: isCoreComplete,
        missing: evaluation.missingCore
      },
      recommended: {
        missing: evaluation.missingRecommended
      }
    },
    verification: {
      email: user.isVerified ? 'VERIFIED' : 'PENDING',
      phone: user.phone ? 'VERIFIED' : 'PENDING',
      identity: 'PENDING'
    },
    capabilities: evaluation.capabilities,
    
    // Legacy fields mapped exactly as they were
    isProfileComplete: legacyIsComplete,
    completedSteps,
    pendingSteps,
    totalSteps,
    completedCount,
  };
};
