import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
const watchlistKey = (userId) => `investor_watchlist:${userId}`;
const readList = async (userId) => {
    const row = await prisma.setting.findUnique({ where: { key: watchlistKey(userId) } });
    if (!row?.value)
        return [];
    try {
        const p = JSON.parse(row.value);
        return Array.isArray(p) ? p : [];
    }
    catch {
        return [];
    }
};
const writeList = async (userId, items) => {
    const key = watchlistKey(userId);
    await prisma.setting.upsert({ where: { key }, update: { value: JSON.stringify(items), category: 'investor_watchlist' }, create: { key, value: JSON.stringify(items), category: 'investor_watchlist' } });
};
// Helper: check if a string looks like a UUID
const isUUID = (val) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
// Batch resolve multiple industry values in one DB call
const batchResolveIndustry = async (startups) => {
    const uuidIds = [...new Set(startups
            .map(s => s.founderProfile?.industry)
            .filter(isUUID))];
    const industryMap = {};
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
export const listStartups = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const q = req.query.q;
        const industry = req.query.industry;
        const stage = req.query.stage;

        const acceptedInvestments = await prisma.investment.findMany({
            where: { status: 'Accepted', deletedAt: null },
            select: { startup: true }
        });
        const acceptedStartupIds = acceptedInvestments.map(i => i.startup).filter(id => !!id);

        // 1. Build where clause for startup ideas
        const where = {
            deletedAt: null,
            status: 'active',
            visibility: 'Public',
            id: { notIn: acceptedStartupIds }
        };

        if (industry) {
            if (industry.includes(',')) {
                where.industry = { in: industry.split(',').map(i => i.trim()).filter(Boolean) };
            } else {
                where.industry = industry;
            }
        }
        if (stage) {
            if (stage.includes(',')) {
                where.stage = { in: stage.split(',').map(s => s.trim()).filter(Boolean) };
            } else {
                where.stage = stage;
            }
        }

        // If q is passed, search inside startup idea name OR founder full name
        if (q) {
            const matchingFounders = await prisma.user.findMany({
                where: { role: 'founder', fullName: { contains: q } },
                select: { id: true }
            });
            const founderIds = matchingFounders.map(f => f.id);
            where.OR = [
                { startup: { contains: q } },
                { founder: { in: founderIds } }
            ];
        }

        // 2. Fetch startup ideas with pagination and count
        const [startupIdeas, total] = await Promise.all([
            prisma.startupIdea.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.startupIdea.count({ where })
        ]);

        // 3. Fetch matching founders, watchlist, and investments
        const founderIds = [...new Set(startupIdeas.map(i => i.founder))];
        const [founders, watchlist, investments] = await Promise.all([
            prisma.user.findMany({
                where: { id: { in: founderIds } },
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
                }
            }),
            readList(req.user.id),
            prisma.investment.findMany({
                where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
                select: { startup: true }
            })
        ]);

        // Resolve industry UUIDs to names for the founders
        const resolvedFounders = await batchResolveIndustry(founders);

        // Build founder mapping for fast lookup (match by ID or fullName)
        const founderMap = {};
        resolvedFounders.forEach(f => {
            founderMap[f.id] = f;
            founderMap[f.fullName] = f;
        });

        // Build sets for O(1) lookups
        const savedIds = new Set(watchlist.map(w => w.startupId));
        const investedIds = new Set(investments.map(i => i.startup));

        // Fetch all investments for these startup ideas to calculate fundingRaised
        const startupIdsForBids = startupIdeas.map(i => i.id);
        const investmentsForIdeas = await prisma.investment.findMany({
            where: { startup: { in: startupIdsForBids } },
            select: { startup: true, offer: true }
        });

        // Group by startup idea ID
        const fundingRaisedMap = {};
        investmentsForIdeas.forEach(inv => {
            if (!fundingRaisedMap[inv.startup]) {
                fundingRaisedMap[inv.startup] = 0;
            }
            fundingRaisedMap[inv.startup] += (inv.offer || 0);
        });

        // 4. Map ideas to response format
        const defaultFounder = resolvedFounders[0] || null;
        const data = startupIdeas.map(idea => {
            const f = founderMap[idea.founder] || defaultFounder;
            const founderInfo = f ? {
                id: f.id,
                fullName: f.fullName,
                avatarUrl: f.avatarUrl,
                city: f.city,
                country: f.country,
                bio: f.bio,
                createdAt: f.createdAt,
                profileId: f.founderProfile?.id ?? null,
                startupName: f.founderProfile?.startupName ?? idea.startup,
                industry: f.founderProfile?.industry ?? idea.industry,
                stage: f.founderProfile?.stage ?? idea.stage,
                raised: f.founderProfile?.raised ?? idea.funding,
                teamSize: f.founderProfile?.teamSize ?? 0
            } : {
                id: 'fd-0',
                fullName: idea.founder,
                avatarUrl: null,
                city: null,
                country: null,
                bio: null,
                createdAt: idea.createdAt,
                profileId: null,
                startupName: idea.startup,
                industry: idea.industry,
                stage: idea.stage,
                raised: idea.funding,
                teamSize: 0
            };

            const { founder, ...rest } = idea;
            return {
                ...rest,
                founderId: founderInfo.id,
                founderName: founderInfo.fullName,
                isSaved: savedIds.has(idea.id) || savedIds.has(founder),
                hasInvested: investedIds.has(idea.id) || investedIds.has(founder),
                fundingRaised: fundingRaisedMap[idea.id] || 0,
                founder: founderInfo
            };
        });

        return res.json(successResponse('Startups retrieved', data, {
            page, limit, total, totalPages: Math.ceil(total / limit)
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getStartupDetails = async (req, res, next) => {
    try {
        const idea = await prisma.startupIdea.findFirst({
            where: { id: req.params.id, deletedAt: null }
        });
        if (!idea) {
            return res.status(404).json(errorResponse('Startup not found', 'NOT_FOUND'));
        }
        let founderUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: idea.founder, role: 'founder' },
                    { fullName: idea.founder, role: 'founder' }
                ]
            },
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
            }
        });
        
        let founderInfo = null;
        if (founderUser) {
            const [resolvedFounder] = await batchResolveIndustry([founderUser]);
            founderInfo = {
                id: resolvedFounder.id,
                fullName: resolvedFounder.fullName,
                avatarUrl: resolvedFounder.avatarUrl,
                city: resolvedFounder.city,
                country: resolvedFounder.country,
                bio: resolvedFounder.bio,
                createdAt: resolvedFounder.createdAt,
                profileId: resolvedFounder.founderProfile?.id ?? null,
                startupName: resolvedFounder.founderProfile?.startupName ?? null,
                industry: resolvedFounder.founderProfile?.industry ?? null,
                stage: resolvedFounder.founderProfile?.stage ?? null,
                raised: resolvedFounder.founderProfile?.raised ?? null,
                teamSize: resolvedFounder.founderProfile?.teamSize ?? null
            };
        } else {
            // Fallback: pick default/first founder user ID if available so id is always a valid user ID string
            const defaultFounder = await prisma.user.findFirst({ where: { role: 'founder', status: 'active' }, select: { id: true, fullName: true } }).catch(() => null);
            founderInfo = {
                id: defaultFounder?.id || 'fd-0',
                fullName: idea.founder,
                avatarUrl: null,
                city: null,
                country: null,
                bio: null,
                createdAt: idea.createdAt,
                profileId: null,
                startupName: idea.startup,
                industry: idea.industry,
                stage: idea.stage,
                raised: idea.funding,
                teamSize: 0
            };
        }
        const [watchlist, investments] = await Promise.all([
            readList(req.user.id),
            prisma.investment.findMany({
                where: { investor: req.user.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } },
                select: { startup: true }
            })
        ]);
        const savedIds = new Set(watchlist.map(w => w.startupId));
        const investedIds = new Set(investments.map(i => i.startup));
        const { founder, ...rest } = idea;

        // Fetch all investments for this startup idea to calculate fundingRaised
        const investmentsForIdea = await prisma.investment.findMany({
            where: { startup: idea.id },
            select: { offer: true }
        });
        const fundingRaised = investmentsForIdea.reduce((sum, inv) => sum + (inv.offer || 0), 0);

        const data = {
            ...rest,
            founderId: founderInfo.id,
            founderName: founderInfo.fullName,
            isSaved: savedIds.has(idea.id) || savedIds.has(idea.founder),
            hasInvested: investedIds.has(idea.id) || investedIds.has(idea.founder),
            fundingRaised,
            founder: founderInfo
        };
        return res.json(successResponse('Startup details', data));
    }
    catch (error) {
        next(error);
    }
};
export const getRecommendedStartups = async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
};
export const getTrendingStartups = async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
};
export const getFeaturedStartups = async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
};
export const saveStartup = async (req, res, next) => {
    try {
        const startupId = req.params.id;
        const { notes, priority } = req.body || {};
        const items = await readList(req.user.id);
        const exists = items.find(i => i.startupId === startupId);
        if (exists)
            return res.status(409).json(errorResponse('Startup already saved to watchlist', 'CONFLICT'));
        const now = new Date().toISOString();
        const entry = { id: randomUUID(), startupId, notes: notes || '', priority: priority || 'medium', savedAt: now, updatedAt: now };
        items.unshift(entry);
        await writeList(req.user.id, items);
        return res.status(201).json(successResponse('Startup saved to watchlist', entry));
    }
    catch (error) {
        next(error);
    }
};
export const unsaveStartup = async (req, res, next) => {
    try {
        const startupId = req.params.id;
        const items = await readList(req.user.id);
        const filtered = items.filter(i => i.startupId !== startupId);
        if (filtered.length === items.length)
            return res.status(404).json(errorResponse('Startup not in watchlist', 'NOT_FOUND'));
        await writeList(req.user.id, filtered);
        return res.json(successResponse('Startup removed from watchlist'));
    }
    catch (error) {
        next(error);
    }
};
