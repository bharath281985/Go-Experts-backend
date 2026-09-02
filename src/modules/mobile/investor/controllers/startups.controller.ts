import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type WatchlistEntry = { id: string; startupId: string; notes: string; priority: string; savedAt: string; updatedAt: string; };
const watchlistKey = (userId: string) => `investor_watchlist:${userId}`;
export const readList = async (userId: string): Promise<WatchlistEntry[]> => {
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
export const formatStartupResponse = (
  idea: any,
  user: any,
  founderProfile: any,
  savedIds: Set<string>,
  investedIds: Set<string>,
  industryMap: Map<string, string>,
  optionMap: Map<string, string>,
  isDetailed: boolean = false,
  platformRaisedMap?: Map<string, number>
) => {
  if (!idea) return null;

  let reg: any = {};
  let userObj: any = null;

  if (user) {
    reg = parseRegData(user.registrationData);
    // Minimal user fields for list view
    userObj = {
      id: user.id,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl || null,
      city: user.city || reg.city || "",
      countryId: user.country || reg.country || "",
      role: user.role || 'founder',
    };

    // Append full fields only for detail view
    if (isDetailed) {
      userObj.email = user.email;
      userObj.logo = user.avatarUrl || null;
      userObj.bio = user.bio || reg.bio || reg.pitch || "";
      userObj.phone = user.phone || reg.phone || reg.mobile || "";
      userObj.registrationData = reg;
    }
  } else {
    const fallbackName = idea.founder || idea.startup || "Founder";
    userObj = {
      id: idea.founder || idea.id,
      fullName: fallbackName,
      avatarUrl: idea.logo || null,
      city: "",
      countryId: "",
      role: "founder",
    };
    if (isDetailed) {
      userObj.email = "";
      userObj.logo = idea.logo || null;
      userObj.bio = "";
      userObj.phone = "";
    }
  }

  const resolveDisplayName = (value: string | null | undefined) =>
    isUUID(value) ? industryMap.get(value) || optionMap.get(value) || '' : value || '';
  const industryValue = resolveDisplayName(idea.industry);
  const categoryValue = resolveDisplayName(idea.category);
  const stageValue = resolveDisplayName(idea.stage);

  const teamSize = founderProfile?.teamSize ?? (reg.teamSize ? parseInt(reg.teamSize) : 1);
  const location = [userObj?.city, userObj?.countryId].filter(Boolean).join(', ') || "";

  const raised = platformRaisedMap?.get(idea.id) || 0;

  const goal = idea.funding || 0;
  let percentage = goal > 0 ? (raised / goal) * 100 : 0;
  percentage = parseFloat(percentage.toFixed(1));
  if (percentage > 100) percentage = 100;

  let tags: string[] = [];
  if (Array.isArray(reg.tags) && reg.tags.length > 0) {
    tags = reg.tags
      .map((tag: unknown) => resolveDisplayName(String(tag)))
      .filter(Boolean);
  } else {
    tags = [categoryValue, industryValue, "Technology", "Startup", "Innovation"].filter(Boolean).slice(0, 5) as string[];
  }

  let gallery: string[] = [];
  if (Array.isArray(reg.gallery)) {
    gallery = reg.gallery;
  } else if (reg.gallery && typeof reg.gallery === 'string') {
    try { gallery = JSON.parse(reg.gallery); } catch (e) { }
  }
  if (!Array.isArray(gallery)) gallery = [];

  const additionalCount = gallery.length > 4 ? gallery.length - 4 : 0;

  const baseResult: any = {
    id: idea.id,
    startup: idea.startup,
    tagline: reg.tagline || reg.mission || "Connecting Experts, Building Success",
    website: reg.website || reg.websiteUrl || "",
    location: location,
    description: reg.description || reg.pitch || userObj?.bio || "",
    logo: idea.logo,
    coverUrl: idea.coverUrl,

    industry: { id: idea.industry || '', name: industryValue },
    industryId: idea.industry || '',
    industryName: industryValue,
    category: { id: idea.category || '', name: categoryValue },
    categoryId: idea.category || '',
    categoryName: categoryValue,
    stage: { id: idea.stage || '', name: stageValue },
    stageId: idea.stage || '',
    stageName: stageValue,

    metrics: {
      fundingGoal: goal,
      equityOffered: idea.equity || 0,
      teamSize: teamSize
    },

    fundingProgress: {
      raised: raised,
      goal: goal,
      percentage: percentage
    },

    tags: tags,

    media: {
      gallery: gallery.slice(0, 4),
      additionalCount: additionalCount
    },

    status: idea.status,
    visibility: idea.visibility,
    views: idea.views,
    interestedInvestors: idea.interestedInvestors,
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,

    user: userObj ? { ...userObj, isVerified: user?.isVerified || false } : null,
    isSaved: savedIds.has(idea.id) || (user && savedIds.has(user.id)),
    hasInvested: investedIds.has(idea.id)
  };

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
export const loadRelatedDataForIdeas = async (ideas: any[]) => {
  const founderIds = [...new Set(ideas.map(i => i.founder).filter(Boolean))];
  let founders: any[] = [];
  if (founderIds.length > 0) {
    founders = await prisma.user.findMany({
      where: {
        OR: [
          { id: { in: founderIds } },
          { email: { in: founderIds } },
          { fullName: { in: founderIds } }
        ]
      },
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
    userMap.set(f.email, f);
    userMap.set(f.fullName, f);
    if (f.founderProfile) {
      fpMap.set(f.id, f.founderProfile);
      fpMap.set(f.email, f.founderProfile);
      fpMap.set(f.fullName, f.founderProfile);
    }
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
    try {
      const rows = await (prisma as any).masterOption.findMany({ where: { id: { in: optionIds } }, select: { id: true, label: true } });
      rows.forEach((r: any) => optionMap.set(r.id, r.label));
    } catch { }

    const missingIds = optionIds.filter((id: string) => !optionMap.has(id));
    if (missingIds.length > 0) {
      try {
        const stages = await prisma.startupStage.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } });
        stages.forEach((s: any) => optionMap.set(s.id, s.name));
      } catch { }
      try {
        const cats = await (prisma as any).projectCategory?.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } });
        cats?.forEach((c: any) => optionMap.set(c.id, c.name));
      } catch { }
      try {
        const skillCats = await prisma.skillCategory.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } });
        skillCats.forEach((c: any) => optionMap.set(c.id, c.name));
      } catch { }
      try {
        const industries = await prisma.industry.findMany({ where: { id: { in: missingIds } }, select: { id: true, name: true } });
        industries.forEach((item: any) => optionMap.set(item.id, item.name));
      } catch { }
    }
  }

  const unresolvedIndustryIds = industryIds.filter((id: string) => !industryMap.has(id));
  if (unresolvedIndustryIds.length > 0) {
    const [projectCategories, skillCategories, masterOptions] = await Promise.all([
      (prisma as any).projectCategory?.findMany({ where: { id: { in: unresolvedIndustryIds } }, select: { id: true, name: true } }).catch(() => []) || [],
      prisma.skillCategory.findMany({ where: { id: { in: unresolvedIndustryIds } }, select: { id: true, name: true } }).catch(() => []),
      (prisma as any).masterOption?.findMany({ where: { id: { in: unresolvedIndustryIds } }, select: { id: true, label: true } }).catch(() => []) || [],
    ]);
    projectCategories.forEach((item: any) => industryMap.set(item.id, item.name));
    skillCategories.forEach((item: any) => industryMap.set(item.id, item.name));
    masterOptions.forEach((item: any) => industryMap.set(item.id, item.label || ''));
  }

  // Calculate platform raised dynamically based on ACTIVE/COMPLETED/OFFER investments
  const platformRaisedMap = new Map<string, number>();
  const ideaIds = ideas.map(i => i.id).filter(Boolean);
  if (ideaIds.length > 0) {
    const agg = await prisma.investment.groupBy({
      by: ['startup'],
      _sum: { offer: true },
      where: { startup: { in: ideaIds }, status: { in: ['Offer', 'Pending', 'Active', 'Completed', 'Closed'] } }
    });
    agg.forEach((a: any) => platformRaisedMap.set(a.startup, parseFloat(a._sum.offer ?? 0)));
  }

  return { userMap, fpMap, industryMap, optionMap, platformRaisedMap };
};

export const listStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const q = req.query.q as string;
    const industry = req.query.industry as string;
    const stage = req.query.stage as string;

    const where: any = {
      status: 'active',
      deletedAt: null,
      NOT: [
        { startup: { contains: "'s Startup" } },
        { startup: { contains: "’s Startup" } },
        { startup: '' }
      ]
    };
    if (req.user?.id) where.founder = { not: req.user.id };
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

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => {
      // isDetailed = false by default
      return formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap);
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

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas([idea]);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    // pass isDetailed = true
    const data = formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, true, platformRaisedMap);
    return res.json(successResponse('Startup details', data));
  } catch (error) { next(error); }
};

export const getRecommendedStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [ideas, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          NOT: [
            { startup: { contains: "'s Startup" } },
            { startup: { contains: "’s Startup" } },
            { startup: '' }
          ],
          ...(req.user?.id ? { founder: { not: req.user.id } } : {})
        },
        take: 10, orderBy: { createdAt: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap)).filter(Boolean);
    return res.json(successResponse('Recommended startups', data));
  } catch (error) { next(error); }
};

export const getTrendingStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [ideas, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          NOT: [
            { startup: { contains: "'s Startup" } },
            { startup: { contains: "’s Startup" } },
            { startup: '' }
          ],
          ...(req.user?.id ? { founder: { not: req.user.id } } : {})
        },
        take: 10, orderBy: { views: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap)).filter(Boolean);
    return res.json(successResponse('Trending startups', data));
  } catch (error) { next(error); }
};

export const getFeaturedStartups = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [ideas, watchlist, investments] = await Promise.all([
      prisma.startupIdea.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          NOT: [
            { startup: { contains: "'s Startup" } },
            { startup: { contains: "’s Startup" } },
            { startup: '' }
          ],
          ...(req.user?.id ? { founder: { not: req.user.id } } : {})
        },
        take: 5, orderBy: { interestedInvestors: 'desc' }
      }),
      readList(req.user.id),
      prisma.investment.findMany({
        where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
        select: { startup: true }
      })
    ]);

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(ideas);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(investments.map(i => i.startup));

    const data = ideas.map(idea => formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap)).filter(Boolean);
    return res.json(successResponse('Featured startups', data));
  } catch (error) { next(error); }
};

export const saveStartup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let startupId = req.params.id;

    // Resolve if it's a founder ID instead of startup ID
    let idea = await prisma.startupIdea.findUnique({ where: { id: startupId } }).catch(() => null);
    if (!idea) {
      idea = await prisma.startupIdea.findFirst({
        where: { founder: startupId, deletedAt: null },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null);
    }
    if (!idea) return res.status(404).json(errorResponse('Startup not found to save', 'NOT_FOUND'));
    startupId = idea.id;

    const { notes, priority } = req.body || {};
    const items = await readList(req.user.id);
    const existingIndex = items.findIndex(i => i.startupId === startupId);

    const checkInvestment = await prisma.investment.findFirst({
      where: { investor: req.user.id, startup: startupId, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } }
    });

    if (existingIndex >= 0) {
      // Toggle off: remove from watchlist
      items.splice(existingIndex, 1);
      await writeList(req.user.id, items);
      return res.json(successResponse('Startup removed from watchlist', { isSaved: false, hasInvested: !!checkInvestment }));
    }

    // Toggle on: add to watchlist
    const now = new Date().toISOString();
    const entry: WatchlistEntry = { id: randomUUID(), startupId, notes: notes || '', priority: priority || 'medium', savedAt: now, updatedAt: now };

    items.unshift(entry);
    await writeList(req.user.id, items);

    return res.status(200).json(successResponse('Startup saved to watchlist', { ...entry, isSaved: true, hasInvested: !!checkInvestment }));
  } catch (error) { next(error); }
};

export const unsaveStartup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let startupId = req.params.id;

    // Resolve if it's a founder ID
    let idea = await prisma.startupIdea.findUnique({ where: { id: startupId } }).catch(() => null);
    if (!idea) {
      idea = await prisma.startupIdea.findFirst({
        where: { founder: startupId, deletedAt: null },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null);
    }
    if (idea) startupId = idea.id;

    const items = await readList(req.user.id);
    const filtered = items.filter(i => i.startupId !== startupId);
    await writeList(req.user.id, filtered);
    return res.json(successResponse('Startup removed from watchlist', { isSaved: false }));
  } catch (error) { next(error); }
};
