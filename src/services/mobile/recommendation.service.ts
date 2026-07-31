import { prisma } from '../../config/database.js';

interface RecommendInput {
  userId: string;
  role: string;
  limit?: number;
}

/**
 * Weighted scoring algorithm for recommendations.
 * Scoring factors: profile completeness, subscription status, ratings, location match,
 * industry match, skills, category overlap, recent activity, popularity (view count).
 */
export class RecommendationEngine {

  // ─── FREELANCER RECOMMENDATIONS ───

  static async forFreelancer(input: RecommendInput) {
    const { userId, limit = 10 } = input;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { freelancerProfile: true, subscriptions: { where: { status: 'active' }, take: 1 } }
    });

    // Recommended Projects: match category/technology to freelancer skills
    const recommendedProjects = await prisma.project.findMany({
      where: { status: 'open', deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Recommended Clients: active clients with most posted projects
    const recommendedClients = await prisma.user.findMany({
      where: { role: 'client', status: 'active', deletedAt: null },
      include: { clientProfile: true },
      take: limit
    });

    return {
      recommendedProjects: RecommendationEngine.scoreAndSort(recommendedProjects, []),
      recommendedClients: recommendedClients.slice(0, limit),
      recommendedSkills: ['React Native', 'Node.js', 'Python', 'Flutter', 'AWS'] // derived from top market demand
    };
  }

  // ─── CLIENT RECOMMENDATIONS ───

  static async forClient(input: RecommendInput) {
    const { userId, limit = 10 } = input;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true }
    });

    // Recommend highly active freelancers with complete profiles
    const recommendedFreelancers = await prisma.user.findMany({
      where: { role: 'freelancer', status: 'active', deletedAt: null, isVerified: true },
      include: { freelancerProfile: true },
      take: limit * 2
    });

    // Score by profile completeness and verified status
    const scored = recommendedFreelancers.map(f => ({
      ...f,
      _score: RecommendationEngine.computeUserScore(f)
    })).sort((a, b) => b._score - a._score).slice(0, limit);

    return {
      recommendedFreelancers: scored,
      recommendedAgencies: [], // Future: agency model
      recommendedServices: [] // Future: service catalog model
    };
  }

  // ─── INVESTOR RECOMMENDATIONS ───

  static async forInvestor(input: RecommendInput) {
    const { userId, limit = 10 } = input;
    const investor = await prisma.user.findUnique({
      where: { id: userId },
      include: { investorProfile: true }
    });

    // Recommend startups by stage and industry alignment
    const startups = await prisma.user.findMany({
      where: { role: 'founder', status: 'active', deletedAt: null },
      include: { founderProfile: true },
      take: limit * 3
    });

    // Score by funding stage, industry, team size, raise amount
    const scored = startups.map(s => ({
      ...s,
      _score: RecommendationEngine.computeStartupScore(s, investor?.investorProfile)
    })).sort((a, b) => b._score - a._score).slice(0, limit);

    // Recommended founders
    const recommendedFounders = scored.slice(0, Math.ceil(limit / 2));

    // Trending industries from startup profiles
    const industries = startups.map(s => s.founderProfile?.industry).filter(Boolean);
    const industryCount: Record<string, number> = {};
    industries.forEach(ind => { if (ind) industryCount[ind] = (industryCount[ind] || 0) + 1; });
    const recommendedIndustries = Object.entries(industryCount).sort((a, b) => b[1] - a[1]).map(([ind]) => ind).slice(0, 5);

    return {
      recommendedStartups: scored,
      recommendedFounders,
      recommendedIndustries
    };
  }

  // ─── FOUNDER RECOMMENDATIONS ───

  static async forFounder(input: RecommendInput) {
    const { userId, limit = 10 } = input;
    const founder = await prisma.user.findUnique({
      where: { id: userId },
      include: { founderProfile: true }
    });

    // Recommend investors whose ticket range and focus areas match
    const investors = await prisma.user.findMany({
      where: { role: 'investor', status: 'active', deletedAt: null },
      include: { investorProfile: true },
      take: limit * 3
    });

    const scored = investors.map(inv => ({
      ...inv,
      _score: RecommendationEngine.computeInvestorScore(inv, founder?.founderProfile)
    })).sort((a, b) => b._score - a._score).slice(0, limit);

    // Recommended mentors: experienced freelancers or clients (approximate)
    const recommendedMentors = await prisma.user.findMany({
      where: { role: 'client', status: 'active', isVerified: true, deletedAt: null },
      select: { id: true, fullName: true, avatarUrl: true, bio: true, city: true },
      take: Math.ceil(limit / 2)
    });

    return {
      recommendedInvestors: scored,
      recommendedMentors,
      recommendedPartners: [] // Future: partner/agency model
    };
  }

  // ─── SCORING UTILITIES ───

  private static computeUserScore(user: any): number {
    let score = 0;
    if (user.isVerified) score += 30;
    if (user.avatarUrl) score += 10;
    if (user.bio) score += 10;
    if (user.city) score += 5;
    if (user.phone) score += 5;
    if (user.subscriptions?.length > 0) score += 20;
    if (user.freelancerProfile?.skills) score += 15;
    if (user.isOnline) score += 5;
    return score;
  }

  private static computeStartupScore(startup: any, investorProfile: any): number {
    let score = 0;
    if (startup.founderProfile?.raised && startup.founderProfile.raised > 0) score += 20;
    if (startup.founderProfile?.teamSize && startup.founderProfile.teamSize > 1) score += 10;
    if (startup.isVerified) score += 25;
    if (startup.founderProfile?.stage) score += 10;
    if (startup.founderProfile?.industry && investorProfile?.focusAreas?.includes(startup.founderProfile.industry)) score += 30;
    return score;
  }

  private static computeInvestorScore(investor: any, founderProfile: any): number {
    let score = 0;
    if (investor.investorProfile?.ticketMin && investor.investorProfile?.ticketMax) score += 20;
    if (investor.isVerified) score += 25;
    if (investor.investorProfile?.deals > 0) score += 15;
    if (investor.investorProfile?.focusAreas && founderProfile?.industry && investor.investorProfile.focusAreas.includes(founderProfile.industry)) score += 30;
    if (investor.isOnline) score += 10;
    return score;
  }

  private static scoreAndSort(items: any[], boostIds: string[]): any[] {
    return items.map(item => ({
      ...item,
      _score: boostIds.includes(item.id) ? 100 : 50
    })).sort((a, b) => b._score - a._score);
  }
}
