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
    const section = await getSettingsSection('recommendation_tabs');
    const tabs = section?.data as Record<string, any[]> | undefined;
    const role = req.user.role as keyof typeof tabs;
    const recommendations = tabs?.[role] ?? [];

    const itemLists = await buildRecommendationItems(req.user.role, req.user.id);
    return res.json(successResponse('Recommendations retrieved', {
      recommendedRoles: recommendations,
      roleTabs: recommendations,
      recommendedItems: itemLists,
    }));
  } catch (error) { next(error); }
};

async function buildRecommendationItems(role: string, userId: string) {
  const limit = 5;

  if (role === 'freelancer') {
    const [projects, clients, startups] = await Promise.all([
      prisma.project.findMany({
        where: { status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.user.findMany({
        where: { role: 'client', status: 'active', deletedAt: null },
        include: { clientProfile: true },
        take: limit,
      }),
      prisma.user.findMany({
        where: { role: 'founder', status: 'active', deletedAt: null },
        include: { founderProfile: true },
        take: limit,
      }),
    ]);

    return {
      projects: projects.map((p) => ({ id: p.id, title: p.title, subtitle: p.category, description: p.description ?? p.technology })),
      clients: clients.map((c) => ({ id: c.id, title: c.fullName, subtitle: c.clientProfile?.company ?? 'Client', description: c.clientProfile?.industry ?? c.city ?? '' })),
      startups: startups.map((s) => ({ id: s.id, title: s.fullName, subtitle: s.founderProfile?.startupName ?? 'Startup', description: s.founderProfile?.industry ?? s.city ?? '' })),
    };
  }

  if (role === 'client') {
    const [freelancers, projects, investors] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'freelancer', status: 'active', isVerified: true, deletedAt: null },
        include: { freelancerProfile: true },
        take: limit,
      }),
      prisma.project.findMany({
        where: { status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] }, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.user.findMany({
        where: { role: 'investor', status: 'active', deletedAt: null },
        include: { investorProfile: true },
        take: limit,
      }),
    ]);
    return {
      freelancers: freelancers.map((f) => ({ id: f.id, title: f.fullName, subtitle: f.freelancerProfile?.skills ?? 'Freelancer', description: f.freelancerProfile?.industry ?? f.city ?? '' })),
      projects: projects.map((p) => ({ id: p.id, title: p.title, subtitle: p.category, description: p.description ?? p.technology })),
      investors: investors.map((i) => ({ id: i.id, title: i.fullName, subtitle: i.investorProfile?.firm ?? 'Investor', description: i.investorProfile?.focusAreas ?? i.city ?? '' })),
    };
  }

  if (role === 'investor') {
    const [startups, founders, freelancers] = await Promise.all([
      prisma.user.findMany({ where: { role: 'founder', status: 'active', deletedAt: null }, include: { founderProfile: true }, take: limit }),
      prisma.user.findMany({ where: { role: 'founder', status: 'active', deletedAt: null }, include: { founderProfile: true }, take: limit }),
      prisma.user.findMany({ where: { role: 'freelancer', status: 'active', isVerified: true, deletedAt: null }, include: { freelancerProfile: true }, take: limit }),
    ]);
    return {
      startups: startups.map((s) => ({ id: s.id, title: s.fullName, subtitle: s.founderProfile?.startupName ?? 'Startup', description: s.founderProfile?.industry ?? s.city ?? '' })),
      founders: founders.map((f) => ({ id: f.id, title: f.fullName, subtitle: f.founderProfile?.stage ?? 'Founder', description: f.founderProfile?.industry ?? f.city ?? '' })),
      freelancers: freelancers.map((f) => ({ id: f.id, title: f.fullName, subtitle: f.freelancerProfile?.skills ?? 'Freelancer', description: f.freelancerProfile?.industry ?? f.city ?? '' })),
    };
  }

  const [investors, freelancers, clients] = await Promise.all([
    prisma.user.findMany({ where: { role: 'investor', status: 'active', deletedAt: null }, include: { investorProfile: true }, take: limit }),
    prisma.user.findMany({ where: { role: 'freelancer', status: 'active', isVerified: true, deletedAt: null }, include: { freelancerProfile: true }, take: limit }),
    prisma.user.findMany({ where: { role: 'client', status: 'active', deletedAt: null }, include: { clientProfile: true }, take: limit }),
  ]);

  return {
    investors: investors.map((i) => ({ id: i.id, title: i.fullName, subtitle: i.investorProfile?.firm ?? 'Investor', description: i.investorProfile?.focusAreas ?? i.city ?? '' })),
    freelancers: freelancers.map((f) => ({ id: f.id, title: f.fullName, subtitle: f.freelancerProfile?.skills ?? 'Freelancer', description: f.freelancerProfile?.industry ?? f.city ?? '' })),
    clients: clients.map((c) => ({ id: c.id, title: c.fullName, subtitle: c.clientProfile?.company ?? 'Client', description: c.clientProfile?.industry ?? c.city ?? '' })),
  };
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
