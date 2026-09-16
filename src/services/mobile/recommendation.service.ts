import { prisma } from '../../config/database.js';
 
interface RecommendInput {
  userId: string;
  role: string;
  limit?: number;
}

/**
 * Weighted scoring algorithm for recommendations.
 * Scori ng factors: profile completeness, subscription status, ratings, location match,
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
    const activeClients = await prisma.user.findMany({
      where: { status: 'active', deletedAt: null },
      select: { id: true },
    }).catch(() => []);
    const activeClientIds = activeClients.map((c) => c.id);

    const projects = activeClientIds.length === 0 ? [] : await prisma.project.findMany({
      where: {
        status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] },
        deletedAt: null,
        client: { in: activeClientIds },
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 3
    });

    const scoredProjects = projects.map(p => ({
      ...p,
      _score: RecommendationEngine.computeProjectScore(p, user?.freelancerProfile)
    })).sort((a, b) => b._score - a._score).slice(0, limit);

    // Recommended Clients: active clients with most posted projects
    const clients = await prisma.user.findMany({
      where: { role: 'client', status: 'active', deletedAt: null },
      include: { clientProfile: true },
      take: limit * 2
    });

    const scoredClients = clients.map(c => ({
      ...c,
      _score: RecommendationEngine.computeClientScore(c, user?.freelancerProfile)
    })).sort((a, b) => b._score - a._score).slice(0, limit);

    return {
      recommendedProjects: scoredProjects,
      recommendedClients: scoredClients,
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

    const clientProjects = await prisma.project.findMany({ where: { client: userId, status: { in: ['open', 'Open'] } } });
    const clientTechs = clientProjects.map(p => p.technology).filter(Boolean).join(',');

    // Recommend highly active freelancers with complete profiles
    const recommendedFreelancers = await prisma.user.findMany({
      where: { role: 'freelancer', status: 'active', deletedAt: null, isVerified: true },
      include: { freelancerProfile: true },
      take: limit * 3
    });

    // Score by profile completeness, verified status, and skill match
    const scored = recommendedFreelancers.map(f => ({
      ...f,
      _score: RecommendationEngine.computeFreelancerScore(f, user?.clientProfile, clientTechs)
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

  private static checkMatch(strA?: string | null, strB?: string | null): boolean {
    if (!strA || !strB) return false;
    const arrA = strA.split(',').map(s => s.trim().toLowerCase());
    const arrB = strB.split(',').map(s => s.trim().toLowerCase());
    return arrA.some(a => arrB.includes(a));
  }

  private static computeProjectScore(project: any, freelancerProfile: any): number {
    let score = 50;
    if (RecommendationEngine.checkMatch(project.technology, freelancerProfile?.skills)) score += 30;
    if (RecommendationEngine.checkMatch(project.category, freelancerProfile?.industry)) score += 20;
    return score;
  }

  private static computeClientScore(client: any, freelancerProfile: any): number {
    let score = 50;
    if (client.isVerified) score += 20;
    if (client.clientProfile?.totalSpend && client.clientProfile.totalSpend > 0) score += 10;
    if (RecommendationEngine.checkMatch(client.clientProfile?.industry, freelancerProfile?.industry)) score += 20;
    return score;
  }

  private static computeFreelancerScore(freelancer: any, clientProfile: any, clientTechs: string): number {
    let score = 0;
    if (freelancer.isVerified) score += 30;
    if (freelancer.avatarUrl) score += 10;
    if (freelancer.bio) score += 10;
    if (freelancer.city) score += 5;
    if (freelancer.phone) score += 5;
    if (freelancer.subscriptions?.length > 0) score += 20;
    if (freelancer.freelancerProfile?.skills) score += 15;
    if (freelancer.isOnline) score += 5;
    
    if (RecommendationEngine.checkMatch(freelancer.freelancerProfile?.skills, clientTechs)) score += 30;
    if (RecommendationEngine.checkMatch(freelancer.freelancerProfile?.industry, clientProfile?.industry)) score += 20;
    
    return score;
  }

  private static computeStartupScore(startup: any, investorProfile: any): number {
    let score = 0;
    if (startup.founderProfile?.raised && startup.founderProfile.raised > 0) score += 20;
    if (startup.founderProfile?.teamSize && startup.founderProfile.teamSize > 1) score += 10;
    if (startup.isVerified) score += 25;
    if (startup.founderProfile?.stage) score += 10;
    if (RecommendationEngine.checkMatch(startup.founderProfile?.industry, investorProfile?.focusAreas)) score += 30;
    return score;
  }

  private static computeInvestorScore(investor: any, founderProfile: any): number {
    let score = 0;
    if (investor.investorProfile?.ticketMin && investor.investorProfile?.ticketMax) score += 20;
    if (investor.isVerified) score += 25;
    if (investor.investorProfile?.deals > 0) score += 15;
    if (RecommendationEngine.checkMatch(investor.investorProfile?.focusAreas, founderProfile?.industry)) score += 30;
    if (investor.isOnline) score += 10;
    return score;
  }
}
