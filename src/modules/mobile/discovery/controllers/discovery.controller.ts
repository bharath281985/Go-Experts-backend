import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { RecommendationEngine } from '../../../../services/mobile/recommendation.service.js';
import { getSettingsSection } from '../../../../services/settings/settings.service.js';

export const addRecentlyViewed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.body;
    if (!entityType || !entityId) {
      return res.status(400).json(errorResponse('entityType and entityId are required', 'VALIDATION_ERROR'));
    }
    return res.status(201).json(successResponse('Recently viewed tracked', { entityType, entityId }));
  } catch (error) { next(error); }
};

export const listRecentlyViewed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    return res.json(successResponse('Recently viewed', [], { page, limit, total: 0, totalPages: 0 }));
  } catch (error) { next(error); }
};

export const clearRecentlyViewed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Recently viewed cleared'));
  } catch (error) { next(error); }
};

export const deleteRecentlyViewedItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Recently viewed item removed'));
  } catch (error) { next(error); }
};

export const getRecommendations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.user?.role || 'freelancer';
    const userId = req.user?.id || '';

    let recommendations: any[] = [];
    try {
      const section = await getSettingsSection('recommendation_tabs');
      const tabs = section?.data as Record<string, any[]> | undefined;
      recommendations = tabs?.[role] ?? [];
    } catch {
      recommendations = [];
    }

    const itemLists = await buildRecommendationItems(role, userId);
    return res.json(successResponse('Recommendations retrieved', {
      recommendedRoles: recommendations,
      roleTabs: recommendations,
      recommendedItems: itemLists,
    }));
  } catch (error) {
    return res.json(successResponse('Recommendations retrieved', {
      recommendedRoles: [],
      roleTabs: [],
      recommendedItems: {},
    }));
  }
};

function cleanTag(val: string | null | undefined, fallback: string): string {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed || /^[0-9a-fA-F-]{24,}$/.test(trimmed)) return fallback;
  const parts = trimmed.split(',').map(s => s.trim()).filter(s => s && !/^[0-9a-fA-F-]{24,}$/.test(s));
  return parts.length > 0 ? parts[0] : fallback;
}

function cleanDesc(val: string | null | undefined, fallback: string = ''): string {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed || /^[0-9a-fA-F-]{24,}$/.test(trimmed)) return fallback;
  const parts = trimmed.split(',').map(s => s.trim()).filter(s => s && !/^[0-9a-fA-F-]{24,}$/.test(s));
  return parts.length > 0 ? parts.join(', ') : fallback;
}

function cleanProjectTitle(title: string | null | undefined, category: string | null | undefined, tech: string | null | undefined): string {
  if (!title || typeof title !== 'string') {
    if (category && category.trim()) return `${category.trim()} Project`;
    return 'Full-Stack Development';
  }
  const trimmed = title.trim();
  if (!trimmed || trimmed.toLowerCase() === 'untitled' || trimmed.toLowerCase() === 'untitled project' || trimmed.toLowerCase() === 'project') {
    if (tech && tech.trim()) return `${tech.trim()} Platform Development`;
    if (category && category.trim()) return `${category.trim()} Project`;
    return 'Full-Stack Web & Mobile App';
  }
  return trimmed;
}

function cleanStartupTitle(title: string | null | undefined, startup: string | null | undefined, industry: string | null | undefined): string {
  const name = title || startup;
  if (!name || typeof name !== 'string') return industry ? `${industry} Venture` : 'Next-Gen Startup';
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === 'startup idea' || trimmed.toLowerCase() === 'untitled' || trimmed.includes("'s Startup") || trimmed.includes("’s Startup") || trimmed.includes("s Startup")) {
    return industry ? `${industry} Platform` : 'Next-Gen Startup';
  }
  return trimmed;
}

async function getActiveStartupIdeas(limit: number = 5, excludeUserId?: string) {
  const deletedUsers = await prisma.user.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
  }).catch(() => []);
  const deletedUserIds = deletedUsers.map((f) => f.id);

  return prisma.startupIdea.findMany({
    where: {
      deletedAt: null,
      ...(deletedUserIds.length > 0 ? { founder: { notIn: deletedUserIds } } : {}),
      NOT: [
        { startup: '' },
        { startup: { contains: "'s Startup" } },
        { startup: { contains: "’s Startup" } },
        { startup: { contains: "s Startup" } },
      ],
      ...(excludeUserId ? { founder: { not: excludeUserId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  }).catch(() => []);
}

async function getActiveProjects(limit: number = 5, excludeUserId?: string) {
  const deletedUsers = await prisma.user.findMany({
    where: { deletedAt: { not: null } },
    select: { id: true },
  }).catch(() => []);
  const deletedUserIds = deletedUsers.map((c) => c.id);

  return prisma.project.findMany({
    where: {
      status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] },
      deletedAt: null,
      ...(deletedUserIds.length > 0 ? { client: { notIn: deletedUserIds } } : {}),
      ...(excludeUserId ? { client: { not: excludeUserId } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  }).catch(() => []);
}

function dedupeBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of arr) {
    const key = keyFn(item).toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

async function buildRecommendationItems(role: string, userId: string) {
  const limit = 10;

  try {
    if (role === 'freelancer') {
      const [projects, clients, startups] = await Promise.all([
        getActiveProjects(limit, userId),
        prisma.user.findMany({
          where: { role: 'client', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
          include: { clientProfile: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }).catch(() => []),
        getActiveStartupIdeas(limit, userId),
      ]);

      const mappedProjects = dedupeBy(
        (projects || []).map((p) => ({
          id: p.id,
          title: cleanProjectTitle(p.title, p.category, p.technology),
          subtitle: cleanTag(p.category, 'Project'),
          description: cleanDesc(p.technology ?? p.description, ''),
          budget: p.budget,
        })),
        (p) => p.title
      ).slice(0, 5);

      const mappedClients = dedupeBy(
        (clients || []).map((c) => ({
          id: c.id,
          title: c.fullName || 'Client',
          subtitle: cleanTag(c.clientProfile?.company, 'Client'),
          description: cleanDesc(c.clientProfile?.industry ?? c.city, ''),
        })),
        (c) => c.title
      ).slice(0, 5);

      const mappedStartups = dedupeBy(
        (startups || []).map((s) => ({
          id: s.id,
          title: cleanStartupTitle((s as any).title, s.startup, s.industry),
          subtitle: cleanTag(s.stage, 'Startup'),
          description: cleanDesc(s.industry, ''),
          funding: s.funding,
        })),
        (s) => s.title
      ).slice(0, 5);

      return {
        projects: mappedProjects,
        clients: mappedClients,
        startups: mappedStartups,
      };
    }

    if (role === 'client') {
      const [freelancers, startups, investors] = await Promise.all([
        prisma.user.findMany({
          where: { role: 'freelancer', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
          include: { freelancerProfile: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }).catch(() => []),
        getActiveStartupIdeas(limit, userId),
        prisma.user.findMany({
          where: { role: 'investor', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
          include: { investorProfile: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }).catch(() => []),
      ]);

      const mappedFreelancers = dedupeBy(
        (freelancers || []).map((f) => ({
          id: f.id,
          title: f.fullName || 'Freelancer',
          subtitle: cleanTag(f.freelancerProfile?.skills, 'Freelancer'),
          description: cleanDesc(f.freelancerProfile?.industry ?? f.city, ''),
        })),
        (f) => f.title
      ).slice(0, 5);

      const mappedStartups = dedupeBy(
        (startups || []).map((s) => ({
          id: s.id,
          title: cleanStartupTitle((s as any).title, s.startup, s.industry),
          subtitle: cleanTag(s.stage, 'Startup'),
          description: cleanDesc(s.industry, ''),
          funding: s.funding,
        })),
        (s) => s.title
      ).slice(0, 5);

      const mappedInvestors = dedupeBy(
        (investors || []).map((i) => ({
          id: i.id,
          title: i.fullName || 'Investor',
          subtitle: cleanTag(i.investorProfile?.firm, 'Investor'),
          description: cleanDesc(i.investorProfile?.focusAreas ?? i.city, ''),
        })),
        (i) => i.title
      ).slice(0, 5);

      return {
        freelancers: mappedFreelancers,
        startups: mappedStartups,
        investors: mappedInvestors,
      };
    }

    if (role === 'investor') {
      const [startups, projects, freelancers] = await Promise.all([
        getActiveStartupIdeas(limit, userId),
        getActiveProjects(limit, userId),
        prisma.user.findMany({
          where: { role: 'freelancer', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
          include: { freelancerProfile: true },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }).catch(() => []),
      ]);

      const mappedStartups = dedupeBy(
        (startups || []).map((s) => ({
          id: s.id,
          title: cleanStartupTitle((s as any).title, s.startup, s.industry),
          subtitle: cleanTag(s.stage, 'Startup'),
          description: cleanDesc(s.industry, ''),
          funding: s.funding,
        })),
        (s) => s.title
      ).slice(0, 5);

      const mappedProjects = dedupeBy(
        (projects || []).map((p) => ({
          id: p.id,
          title: cleanProjectTitle(p.title, p.category, p.technology),
          subtitle: cleanTag(p.category, 'Project'),
          description: cleanDesc(p.technology ?? p.description, ''),
          budget: p.budget,
        })),
        (p) => p.title
      ).slice(0, 5);

      const mappedFreelancers = dedupeBy(
        (freelancers || []).map((f) => ({
          id: f.id,
          title: f.fullName || 'Freelancer',
          subtitle: cleanTag(f.freelancerProfile?.skills, 'Freelancer'),
          description: cleanDesc(f.freelancerProfile?.industry ?? f.city, ''),
        })),
        (f) => f.title
      ).slice(0, 5);

      return {
        startups: mappedStartups,
        projects: mappedProjects,
        freelancers: mappedFreelancers,
      };
    }

    const [investors, freelancers, clients] = await Promise.all([
      prisma.user.findMany({ where: { role: 'investor', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) }, include: { investorProfile: true }, orderBy: { createdAt: 'desc' }, take: limit }).catch(() => []),
      prisma.user.findMany({ where: { role: 'freelancer', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) }, include: { freelancerProfile: true }, orderBy: { createdAt: 'desc' }, take: limit }).catch(() => []),
      prisma.user.findMany({ where: { role: 'client', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) }, include: { clientProfile: true }, orderBy: { createdAt: 'desc' }, take: limit }).catch(() => []),
    ]);

    return {
      investors: dedupeBy(
        (investors || []).map((i) => ({ id: i.id, title: i.fullName, subtitle: cleanTag(i.investorProfile?.firm, 'Investor'), description: cleanDesc(i.investorProfile?.focusAreas ?? i.city, '') })),
        (i) => i.title
      ).slice(0, 5),
      freelancers: dedupeBy(
        (freelancers || []).map((f) => ({ id: f.id, title: f.fullName, subtitle: cleanTag(f.freelancerProfile?.skills, 'Freelancer'), description: cleanDesc(f.freelancerProfile?.industry ?? f.city, '') })),
        (f) => f.title
      ).slice(0, 5),
      clients: dedupeBy(
        (clients || []).map((c) => ({ id: c.id, title: c.fullName, subtitle: cleanTag(c.clientProfile?.company, 'Client'), description: cleanDesc(c.clientProfile?.industry ?? c.city, '') })),
        (c) => c.title
      ).slice(0, 5),
    };

  } catch {
    return {
      freelancers: [],
      projects: [],
      investors: [],
      startups: [],
      clients: [],
      founders: [],
    };
  }
}

export const getTrending = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const [trendingFreelancers, trendingStartups, trendingSkills] = await Promise.all([
      prisma.user.findMany({ where: { role: 'freelancer', status: 'active', isVerified: true }, take: limit }),
      prisma.user.findMany({ where: { role: 'founder', status: 'active', isVerified: true }, take: limit }),
      prisma.skill.findMany({ where: { status: 'active' }, take: limit })
    ]);

    return res.json(successResponse('Trending items', {
      freelancers: trendingFreelancers,
      startups: trendingStartups,
      keywords: trendingSkills.map((skill) => skill.name)
    }));
  } catch (error) { next(error); }
};

export const getPopular = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const [popularFreelancers, popularStartups, popularSkills] = await Promise.all([
      prisma.user.findMany({ where: { role: 'freelancer', status: 'active' }, take: limit }),
      prisma.user.findMany({ where: { role: 'founder', status: 'active' }, take: limit }),
      prisma.skill.findMany({ where: { status: 'active' }, take: limit })
    ]);

    return res.json(successResponse('Popular items', {
      freelancers: popularFreelancers,
      startups: popularStartups,
      keywords: popularSkills.map((skill) => skill.name)
    }));
  } catch (error) { next(error); }
};

export const getDiscoveryFeed = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = 5;
    let recommendations = {};

    if (req.user) {
      switch (req.user.role) {
        case 'freelancer':
          recommendations = await RecommendationEngine.forFreelancer({ userId: req.user.id, role: 'freelancer', limit });
          break;
        case 'client':
          recommendations = await RecommendationEngine.forClient({ userId: req.user.id, role: 'client', limit });
          break;
        case 'investor':
          recommendations = await RecommendationEngine.forInvestor({ userId: req.user.id, role: 'investor', limit });
          break;
        case 'founder':
          recommendations = await RecommendationEngine.forFounder({ userId: req.user.id, role: 'founder', limit });
          break;
      }
    }

    const trending = await prisma.user.findMany({ where: { status: 'active', isVerified: true }, take: limit });
    const popular = await prisma.skill.findMany({ where: { status: 'active' }, take: limit });

    return res.json(successResponse('Discovery feed', {
      recommendations,
      trending,
      popular: popular.map((skill) => skill.name)
    }));
  } catch (error) { next(error); }
};
