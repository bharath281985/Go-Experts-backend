import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type WatchlistEntry = { id: string; startupId: string; notes: string; priority: string; savedAt: string; updatedAt: string; };
const watchlistKey = (userId: string) => `investor_watchlist:${userId}`;
const readList = async (userId: string): Promise<WatchlistEntry[]> => {
  const row = await prisma.setting.findUnique({ where: { key: watchlistKey(userId) } });
  if (!row?.value) return [];
  try { const p = JSON.parse(row.value); return Array.isArray(p) ? p : []; } catch { return []; }
};
const writeList = async (userId: string, items: WatchlistEntry[]) => {
  const key = watchlistKey(userId);
  await prisma.setting.upsert({ where: { key }, update: { value: JSON.stringify(items), category: 'investor_watchlist' }, create: { key, value: JSON.stringify(items), category: 'investor_watchlist' } });
};

// Helper: check if a string looks like a UUID
const isUUID = (val: string | null | undefined): val is string => 
  !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Batch resolve multiple industry values in one DB call
const batchResolveIndustry = async (startups: any[]) => {
  const uuidIds = [...new Set(
    startups
      .map(s => s.founderProfile?.industry)
      .filter(isUUID)
  )];

  const industryMap: Record<string, string> = {};
  if (uuidIds.length > 0) {
    const industries = await prisma.industry.findMany({
      where: { id: { in: uuidIds } },
      select: { id: true, name: true }
    });
    industries.forEach(i => { industryMap[i.id] = i.name; });
  }

  return startups.map(s => {
    const raw = s.founderProfile?.industry ?? null;
    const resolvedIndustry = raw
      ? (isUUID(raw) ? (industryMap[raw] ?? null) : raw)
      : null;
    return {
      ...s,
      founderProfile: s.founderProfile
        ? { ...s.founderProfile, industry: resolvedIndustry }
        : null,
    };
  });
};

export const listStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const q = req.query.q as string;
    const industry = req.query.industry as string;
    const stage = req.query.stage as string;

    const where: any = { role: 'founder', status: 'active', deletedAt: null };
    if (q) where.fullName = { contains: q };

    // Fetch startups, investor watchlist, and active investments in parallel
    const [startups, total, watchlist, investments] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          city: true,
          country: true,
          bio: true,
          createdAt: true,
          founderProfile: {
            select: {
              id: true,
              startupName: true,
              industry: true,
              stage: true,
              raised: true,
              teamSize: true,
            }
          }
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    // Resolve industry UUIDs to names
    const resolved = await batchResolveIndustry(startups);

    // Build sets for O(1) lookups
    const savedIds = new Set(watchlist.map(w => w.startupId));
    const investedIds = new Set(investments.map(i => i.startup));

    // Fetch all public startup ideas for founders on this page
    const founderIds = startups.map(s => s.id);
    let allIdeas: any[] = [];
    try {
      allIdeas = await prisma.startupIdea.findMany({
        where: {
          founder: { in: founderIds },
          deletedAt: null,
          visibility: 'Public',
          status: 'active',
        },
        select: {
          id: true,
          startup: true,
          founder: true,
          industry: true,
          category: true,
          stage: true,
          funding: true,
          equity: true,
          visibility: true,
          status: true,
          views: true,
          interestedInvestors: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      allIdeas = [];
    }

    // Group ideas by founder id
    const ideasByFounder: Record<string, any[]> = {};
    for (const idea of allIdeas) {
      if (!ideasByFounder[idea.founder]) ideasByFounder[idea.founder] = [];
      ideasByFounder[idea.founder].push(idea);
    }

    // Apply optional filters
    const filtered = industry || stage
      ? resolved.filter(s => {
          if (industry && s.founderProfile?.industry !== industry) return false;
          if (stage && s.founderProfile?.stage !== stage) return false;
          return true;
        })
      : resolved;

    // Add isSaved, hasInvested and startupIdeas to each startup
    const data = filtered.map(s => ({
      ...s,
      isSaved: savedIds.has(s.id) || savedIds.has(s.founderProfile?.id ?? ''),
      hasInvested: investedIds.has(s.id) || investedIds.has(s.founderProfile?.id ?? ''),
      startupIdeas: ideasByFounder[s.id] ?? [],
    }));

    return res.json(successResponse('Startups retrieved', data, {
      page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit)
    }));
  } catch (error) { next(error); }
};

export const getStartupDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [startup, watchlist, investments] = await Promise.all([
      prisma.user.findFirst({
        where: { id: req.params.id, role: 'founder', status: 'active' },
        select: {
          id: true, fullName: true, avatarUrl: true, city: true, country: true,
          bio: true, phone: true, createdAt: true,
          founderProfile: true,
          reviewsReceived: { take: 5 }
        }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);
    if (!startup) return res.status(404).json(errorResponse('Startup not found', 'NOT_FOUND'));
    const [resolved] = await batchResolveIndustry([startup]);
    
    const isSaved = watchlist.some(w => w.startupId === startup.id || w.startupId === startup.founderProfile?.id);
    const hasInvested = investments.some(i => i.startup === startup.id || i.startup === startup.founderProfile?.id);

    return res.json(successResponse('Startup details', { ...resolved, isSaved, hasInvested }));
  } catch (error) { next(error); }
};

export const getRecommendedStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [startups, watchlist, investments] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'founder', status: 'active', deletedAt: null },
        select: {
          id: true, fullName: true, avatarUrl: true, city: true, country: true,
          founderProfile: { select: { id: true, startupName: true, industry: true, stage: true, raised: true, teamSize: true } }
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);
    const resolved = await batchResolveIndustry(startups);
    const savedIds = new Set(watchlist.map(w => w.startupId));
    const investedIds = new Set(investments.map(i => i.startup));

    const data = resolved.map(s => ({
      ...s,
      isSaved: savedIds.has(s.id) || savedIds.has(s.founderProfile?.id ?? ''),
      hasInvested: investedIds.has(s.id) || investedIds.has(s.founderProfile?.id ?? ''),
    }));
    return res.json(successResponse('Recommended startups', data));
  } catch (error) { next(error); }
};

export const getTrendingStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [startups, watchlist, investments] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'founder', status: 'active', deletedAt: null },
        select: {
          id: true, fullName: true, avatarUrl: true, city: true, country: true,
          founderProfile: { select: { id: true, startupName: true, industry: true, stage: true, raised: true, teamSize: true } }
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);
    const resolved = await batchResolveIndustry(startups);
    const savedIds = new Set(watchlist.map(w => w.startupId));
    const investedIds = new Set(investments.map(i => i.startup));

    const data = resolved.map(s => ({
      ...s,
      isSaved: savedIds.has(s.id) || savedIds.has(s.founderProfile?.id ?? ''),
      hasInvested: investedIds.has(s.id) || investedIds.has(s.founderProfile?.id ?? ''),
    }));
    return res.json(successResponse('Trending startups', data));
  } catch (error) { next(error); }
};

export const getFeaturedStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [startups, watchlist, investments] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'founder', status: 'active', deletedAt: null },
        select: {
          id: true, fullName: true, avatarUrl: true, city: true, country: true,
          founderProfile: { select: { id: true, startupName: true, industry: true, stage: true, raised: true, teamSize: true } }
        },
        take: 5
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);
    const resolved = await batchResolveIndustry(startups);
    const savedIds = new Set(watchlist.map(w => w.startupId));
    const investedIds = new Set(investments.map(i => i.startup));

    const data = resolved.map(s => ({
      ...s,
      isSaved: savedIds.has(s.id) || savedIds.has(s.founderProfile?.id ?? ''),
      hasInvested: investedIds.has(s.id) || investedIds.has(s.founderProfile?.id ?? ''),
    }));
    return res.json(successResponse('Featured startups', data));
  } catch (error) { next(error); }
};

export const saveStartup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const startupId = req.params.id;
    const { notes, priority } = req.body || {};
    const items = await readList(req.user.id);
    const exists = items.find(i => i.startupId === startupId);
    if (exists) return res.status(409).json(errorResponse('Startup already saved to watchlist', 'CONFLICT'));
    const now = new Date().toISOString();
    const entry: WatchlistEntry = { id: randomUUID(), startupId, notes: notes || '', priority: priority || 'medium', savedAt: now, updatedAt: now };
    items.unshift(entry);
    await writeList(req.user.id, items);
    return res.status(201).json(successResponse('Startup saved to watchlist', entry));
  } catch (error) { next(error); }
};

export const unsaveStartup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const startupId = req.params.id;
    const items = await readList(req.user.id);
    const filtered = items.filter(i => i.startupId !== startupId);
    if (filtered.length === items.length) return res.status(404).json(errorResponse('Startup not in watchlist', 'NOT_FOUND'));
    await writeList(req.user.id, filtered);
    return res.json(successResponse('Startup removed from watchlist'));
  } catch (error) { next(error); }
};
