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

// Helper: parse registration data
function parseRegData(regData: any): Record<string, any> {
  if (!regData) return {};
  if (typeof regData === 'string') {
    try { return JSON.parse(regData); } catch { return {}; }
  }
  if (typeof regData === 'object') return regData;
  return {};
}

// Helper to check UUID
const isUUID = (val: string | null | undefined): val is string =>
  !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Helper to format the final JSON exactly as the founder side demands, minus the bids list
const formatStartupResponse = (
  idea: any,
  user: any,
  founderProfile: any,
  savedIds: Set<string>,
  investedIds: Set<string>,
  industryMap: Map<string, string>,
  optionMap: Map<string, string>,
  isDetailed: boolean = false
) => {
  if (!idea) return null;

  let reg: any = {};
  let userObj: any = null;

  if (user) {
    reg = parseRegData(user.registrationData);
    const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

    // Minimal user fields for list view
    userObj = {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl || dicebearUrl,
      city: user.city || reg.city || "",
      countryId: user.country || reg.country || "",
      role: user.role,
    };

    // Append full fields only for detail view
    if (isDetailed) {
      userObj.email = user.email;
      userObj.logo = user.avatarUrl || dicebearUrl;
      userObj.bio = user.bio || reg.bio || reg.pitch || "";
      userObj.phone = user.phone || reg.phone || reg.mobile || "";
      userObj.registrationData = reg;
    }
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
    isSaved: savedIds.has(idea.id) || (user && savedIds.has(user.id)),
    hasInvested: investedIds.has(idea.id) || (user && investedIds.has(user.id))
  };

  // If not detailed, return the stripped down version
  if (!isDetailed) {
    return baseResult;
  }

  // Detailed fields
  const documents = [
    { id: "doc_bp", name: "Business Plan", url: idea.businessPlan || founderProfile?.businessPlan || reg.businessPlan || "https://apiai.goexperts.in/uploads/business_plan.pdf", type: "pdf" },
    { id: "doc_pd", name: "Pitch Deck", url: idea.pitchDeck || founderProfile?.pitchDeck || reg.pitchDeck || "https://apiai.goexperts.in/uploads/pitch_deck.pdf", type: "pdf" }
  ];

  return {
    ...baseResult,
    pitchDeck: idea.pitchDeck,
    businessPlan: idea.businessPlan,
    documents,
    problemStatement: reg.problemStatement || "",
    solution: reg.solution || "",
    targetCustomers: reg.targetCustomers || "",
    marketSize: reg.marketSize || "",
    businessModel: reg.businessModel || "",
    revenueModel: reg.revenueModel || "",
    currentProgress: reg.currentProgress || "",
    demoLink: reg.demoLink || "",
  };
};

// Helper to load related users AND resolve industry/stage names
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

export const listStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const q = req.query.q as string;
    const industry = req.query.industry as string;
    const stage = req.query.stage as string;

    const where: any = { status: 'active', deletedAt: null };
    if (q) where.startup = { contains: q };
    if (industry) where.industry = industry;
    if (stage) where.stage = stage;

    const [ideas, total, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' }
      }),
      prisma.startupIdea.count({ where }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const { userMap, fpMap, industryMap, optionMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => {
      // isDetailed = false by default
      return formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap);
    }).filter(Boolean);

    return res.json(successResponse('Startups retrieved', data, {
      page, limit, total, totalPages: Math.ceil(total / limit)
    }));
  } catch (error) { next(error); }
};

export const getStartupDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // ID could be idea ID or founder ID
    const [ideaFromIdeaId, ideaFromFounderId, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findUnique({ where: { id: req.params.id } }),
      prisma.startupIdea.findFirst({ where: { founder: req.params.id, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const idea = ideaFromIdeaId || ideaFromFounderId;
    if (!idea) return res.status(404).json(errorResponse('Startup not found', 'NOT_FOUND'));

    const { userMap, fpMap, industryMap, optionMap } = await loadRelatedDataForIdeas([idea]);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    // pass isDetailed = true
    const data = formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, true);
    return res.json(successResponse('Startup details', data));
  } catch (error) { next(error); }
};

export const getRecommendedStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [ideas, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findMany({
        where: { status: 'active', deletedAt: null },
        take: 10, orderBy: { createdAt: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const { userMap, fpMap, industryMap, optionMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap)).filter(Boolean);
    return res.json(successResponse('Recommended startups', data));
  } catch (error) { next(error); }
};

export const getTrendingStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [ideas, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findMany({
        where: { status: 'active', deletedAt: null },
        take: 10, orderBy: { views: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const { userMap, fpMap, industryMap, optionMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap)).filter(Boolean);
    return res.json(successResponse('Trending startups', data));
  } catch (error) { next(error); }
};

export const getFeaturedStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [ideas, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findMany({
        where: { status: 'active', deletedAt: null },
        take: 5, orderBy: { interestedInvestors: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const { userMap, fpMap, industryMap, optionMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap)).filter(Boolean);
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
