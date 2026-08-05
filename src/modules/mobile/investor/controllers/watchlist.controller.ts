import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type WatchlistEntry = {
  id: string;
  startupId: string;
  notes?: string;
  priority?: string;
  savedAt: string;
  updatedAt: string;
};

const watchlistKey = (userId: string) => `investor_watchlist:${userId}`;

const readList = async (userId: string): Promise<WatchlistEntry[]> => {
  const row = await prisma.setting.findUnique({ where: { key: watchlistKey(userId) } });
  if (!row?.value) return [];
  try { const p = JSON.parse(row.value); return Array.isArray(p) ? p : []; } catch { return []; }
};

const writeList = async (userId: string, items: WatchlistEntry[]) => {
  const key = watchlistKey(userId);
  await prisma.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(items), category: 'investor_watchlist' },
    create: { key, value: JSON.stringify(items), category: 'investor_watchlist' },
  });
};

// Helper: check UUID
const isUUID = (val: string | null | undefined): val is string =>
  !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Helper: parse registration data
function parseRegData(regData: any): Record<string, any> {
  if (!regData) return {};
  if (typeof regData === 'string') {
    try { return JSON.parse(regData); } catch { return {}; }
  }
  if (typeof regData === 'object') return regData;
  return {};
}

const formatStartupResponse = (
  idea: any,
  user: any,
  founderProfile: any,
  industryMap: Map<string, string>,
  optionMap: Map<string, string>
) => {
  if (!idea) return null;

  let reg: any = {};
  let userObj: any = null;

  if (user) {
    reg = parseRegData(user.registrationData);
    const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

    userObj = {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl || dicebearUrl,
      city: user.city || reg.city || "",
      countryId: user.country || reg.country || "",
      role: user.role,
    };
  }

  const baseResult: any = {
    id: idea.id,
    startup: idea.startup,
    funding: idea.funding,
    equity: idea.equity,
    visibility: idea.visibility,
    status: idea.status,
    logo: idea.logo,
    coverUrl: idea.coverUrl,
    views: idea.views,
    interestedInvestors: idea.interestedInvestors,
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,

    industry: isUUID(idea.industry) ? industryMap.get(idea.industry) || idea.industry : idea.industry,
    category: isUUID(idea.category) ? optionMap.get(idea.category) || idea.category : idea.category,
    stage: isUUID(idea.stage) ? optionMap.get(idea.stage) || idea.stage : idea.stage,

    teamSize: founderProfile?.teamSize ?? (reg.teamSize ? parseInt(reg.teamSize) : 1),
    description: reg.description || reg.pitch || userObj?.bio || "",

    user: userObj,
    isSaved: true,
    hasInvested: false
  };

  return baseResult;
};

const loadRelatedDataForIdeas = async (ideas: any[]) => {
  const founderIds = [...new Set(ideas.map(i => i.founder).filter(Boolean))];
  let founders: any[] = [];
  if (founderIds.length > 0) {
    founders = await prisma.user.findMany({
      where: { id: { in: founderIds } },
      select: {
        id: true, email: true, fullName: true, avatarUrl: true, bio: true, phone: true,
        country: true, city: true, role: true, registrationData: true,
        founderProfile: true
      }
    });
  }

  const userMap = new Map();
  const fpMap = new Map();
  for (const f of founders) {
    userMap.set(f.id, f);
    if (f.founderProfile) fpMap.set(f.id, f.founderProfile);
  }

  const industryIds = [...new Set(ideas.map(i => i.industry).filter(isUUID))];
  const industryMap = new Map();
  if (industryIds.length > 0) {
    const rows = await prisma.industry.findMany({ where: { id: { in: industryIds } }, select: { id: true, name: true } });
    rows.forEach(r => industryMap.set(r.id, r.name));
  }

  const optionIds = [...new Set(ideas.flatMap(i => [i.category, i.stage]).filter(isUUID))];
  const optionMap = new Map();
  if (optionIds.length > 0) {
    const rows = await (prisma as any).masterOption.findMany({ where: { id: { in: optionIds } }, select: { id: true, label: true } });
    rows.forEach((r: any) => optionMap.set(r.id, r.label));
  }

  return { userMap, fpMap, industryMap, optionMap };
};

const populateInvestorWatchlist = async (items: WatchlistEntry[]): Promise<any[]> => {
  if (items.length === 0) return [];
  const startupIds = items.map(i => i.startupId);
  try {
    const ideas = await prisma.startupIdea.findMany({
      where: { id: { in: startupIds } },
    });

    const { userMap, fpMap, industryMap, optionMap } = await loadRelatedDataForIdeas(ideas);

    const ideaMap = new Map<string, any>();
    ideas.forEach(idea => {
      const formatted = formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), industryMap, optionMap);
      ideaMap.set(idea.id, formatted);
    });

    return items.map(item => {
      const startupDetails = ideaMap.get(item.startupId) || null;
      return {
        // Watchlist metadata
        watchlistId: item.id,
        id: startupDetails?.id || item.startupId,
        startupId: item.startupId,
        notes: item.notes || '',
        priority: item.priority || 'medium',
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,

        // Flat details at root level matching Startup APIs
        ...(startupDetails || {}),
      };
    });
  } catch (e) {
    console.error('Error populating watchlist startup', e);
    return items;
  }
};

export const getWatchlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readList(req.user.id);
    const populated = await populateInvestorWatchlist(items);

    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sorted = [...populated].sort((a, b) => {
      const weightA = priorityWeight[String(a.priority).toLowerCase()] || 0;
      const weightB = priorityWeight[String(b.priority).toLowerCase()] || 0;
      if (weightA !== weightB) return weightB - weightA;
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });

    return res.json(successResponse('Watchlist retrieved', sorted, { total: items.length }));
  } catch (error) { next(error); }
};

export const addToWatchlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startupId, notes, priority } = req.body;
    if (!startupId) return res.status(400).json(errorResponse('startupId is required', 'VALIDATION_ERROR'));
    const items = await readList(req.user.id);
    const exists = items.find(i => i.startupId === startupId);
    if (exists) return res.status(409).json(errorResponse('Startup already in watchlist', 'CONFLICT'));
    const now = new Date().toISOString();
    const entry: WatchlistEntry = { id: randomUUID(), startupId, notes: notes || '', priority: priority || 'medium', savedAt: now, updatedAt: now };
    items.unshift(entry);
    await writeList(req.user.id, items);

    const populatedList = await populateInvestorWatchlist([entry]);
    return res.status(201).json(successResponse('Startup added to watchlist', populatedList[0]));
  } catch (error) { next(error); }
};

export const removeFromWatchlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readList(req.user.id);
    const filtered = items.filter(i => i.id !== req.params.id);
    if (filtered.length === items.length) return res.status(404).json(errorResponse('Watchlist entry not found', 'NOT_FOUND'));
    await writeList(req.user.id, filtered);
    return res.json(successResponse('Startup removed from watchlist'));
  } catch (error) { next(error); }
};

export const updateWatchlistNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { notes } = req.body;
    const items = await readList(req.user.id);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx < 0) return res.status(404).json(errorResponse('Watchlist entry not found', 'NOT_FOUND'));
    items[idx] = { ...items[idx], notes, updatedAt: new Date().toISOString() };
    await writeList(req.user.id, items);
    return res.json(successResponse('Notes updated', items[idx]));
  } catch (error) { next(error); }
};

export const updateWatchlistPriority = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { priority } = req.body;
    const items = await readList(req.user.id);
    const idx = items.findIndex(i => i.id === req.params.id);
    if (idx < 0) return res.status(404).json(errorResponse('Watchlist entry not found', 'NOT_FOUND'));
    items[idx] = { ...items[idx], priority, updatedAt: new Date().toISOString() };
    await writeList(req.user.id, items);
    return res.json(successResponse('Priority updated', items[idx]));
  } catch (error) { next(error); }
};
