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

const populateInvestorWatchlist = async (items: WatchlistEntry[]): Promise<any[]> => {
  return Promise.all(
    items.map(async (item) => {
      let startupDetails: any = null;
      try {
        const idea = await prisma.startupIdea.findUnique({
          where: { id: item.startupId },
        });
        if (idea) {
          const founderUser = await prisma.user.findFirst({
            where: { id: idea.founder, role: 'founder' },
            select: {
              id: true,
              fullName: true,
              email: true,
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
                },
              },
            },
          });
          let founderInfo = null;
          if (founderUser) {
            founderInfo = {
              id: founderUser.id,
              fullName: founderUser.fullName,
              email: founderUser.email,
              avatarUrl: founderUser.avatarUrl,
              city: founderUser.city,
              country: founderUser.country,
              bio: founderUser.bio,
              createdAt: founderUser.createdAt,
              profileId: founderUser.founderProfile?.id ?? null,
              startupName: founderUser.founderProfile?.startupName ?? null,
              industry: founderUser.founderProfile?.industry ?? null,
              stage: founderUser.founderProfile?.stage ?? null,
              raised: founderUser.founderProfile?.raised ?? null,
              teamSize: founderUser.founderProfile?.teamSize ?? null,
            };
          }
          startupDetails = {
            id: idea.id,
            startup: idea.startup,
            industry: idea.industry,
            category: idea.category,
            stage: idea.stage,
            funding: idea.funding,
            equity: idea.equity,
            visibility: idea.visibility,
            pitchDeck: idea.pitchDeck,
            businessPlan: idea.businessPlan,
            logo: idea.logo,
            coverUrl: idea.coverUrl,
            status: idea.status,
            views: idea.views,
            interestedInvestors: idea.interestedInvestors,
            createdAt: idea.createdAt,
            updatedAt: idea.updatedAt,
            deletedAt: idea.deletedAt,
            founderId: idea.founder,
            isSaved: true,
            hasInvested: false,
            founder: founderInfo,
          };
        }
      } catch (e) {
        console.error('Error populating watchlist startup', e);
      }
      return {
        // Watchlist metadata
        watchlistId: item.id,
        id: item.id,
        startupId: item.startupId,
        notes: item.notes || '',
        priority: item.priority || 'medium',
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,

        // Flat details at root level
        ...(startupDetails || {}),

        // Nested details for safety
        details: startupDetails || null,
        startup: startupDetails || null,
      };
    })
  );
};

export const getWatchlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readList(req.user.id);
    const populated = await populateInvestorWatchlist(items);
    return res.json(successResponse('Watchlist retrieved', populated, { total: items.length }));
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
