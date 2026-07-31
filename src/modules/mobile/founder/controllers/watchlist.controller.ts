import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/db.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

type WatchlistEntry = {
  id: string;
  investorId: string;
  notes: string;
  priority: string;
  savedAt: string;
  updatedAt: string;
};

const watchlistKey = (userId: string) => `founder_investor_watchlist:${userId}`;

const readList = async (userId: string): Promise<WatchlistEntry[]> => {
  const row = await prisma.setting.findUnique({ where: { key: watchlistKey(userId) } });
  if (!row?.value) return [];
  try {
    const p = JSON.parse(row.value);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

const writeList = async (userId: string, items: WatchlistEntry[]) => {
  const key = watchlistKey(userId);
  await prisma.setting.upsert({
    where: { key },
    update: { value: JSON.stringify(items), category: 'founder_investor_watchlist' },
    create: { key, value: JSON.stringify(items), category: 'founder_investor_watchlist' },
  });
};

const populateFounderWatchlist = async (items: WatchlistEntry[]): Promise<any[]> => {
  if (items.length === 0) return [];
  const investorIds = items.map(i => i.investorId);
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { id: { in: investorIds } },
          { investorProfile: { id: { in: investorIds } } }
        ]
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        city: true,
        country: true,
        bio: true,
        createdAt: true,
        investorProfile: true,
      },
    });

    const userMap = new Map<string, any>();
    users.forEach(u => {
      userMap.set(u.id, u);
      if (u.investorProfile?.id) {
        userMap.set(u.investorProfile.id, u);
      }
    });

    return items.map(item => {
      const investorDetails = userMap.get(item.investorId) || null;
      const investorProfile = investorDetails?.investorProfile ? {
        id: investorDetails.investorProfile.id,
        userId: investorDetails.investorProfile.userId,
        fullName: investorDetails.fullName,
        email: investorDetails.email,
        avatarUrl: investorDetails.avatarUrl,
        city: investorDetails.city,
        country: investorDetails.country,
        bio: investorDetails.bio,
        firm: investorDetails.investorProfile.firm,
        ticketMin: investorDetails.investorProfile.ticketMin,
        ticketMax: investorDetails.investorProfile.ticketMax,
        focusAreas: investorDetails.investorProfile.focusAreas,
        deals: investorDetails.investorProfile.deals,
        createdAt: investorDetails.investorProfile.createdAt,
        updatedAt: investorDetails.investorProfile.updatedAt,
      } : null;

      return {
        // Watchlist metadata
        watchlistId: item.id,
        id: investorDetails?.id || item.investorId,
        investorId: item.investorId,
        notes: item.notes,
        priority: item.priority,
        savedAt: item.savedAt,
        updatedAt: item.updatedAt,
        investorProfile,
      };
    });
  } catch (e) {
    console.error('Error populating watchlist investor', e);
    return items;
  }
};

export const getWatchlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readList(req.user.id);
    const populated = await populateFounderWatchlist(items);
    
    const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sorted = [...populated].sort((a, b) => {
      const weightA = priorityWeight[String(a.priority).toLowerCase()] || 0;
      const weightB = priorityWeight[String(b.priority).toLowerCase()] || 0;
      if (weightA !== weightB) return weightB - weightA;
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });

    return res.json(successResponse('Watchlist retrieved', sorted, { total: items.length }));
  } catch (error) {
    next(error);
  }
};

export const addToWatchlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investorId = req.body.investorId || req.body.startupId;
    const { notes, priority } = req.body;
    if (!investorId) return res.status(400).json(errorResponse('investorId or startupId is required', 'VALIDATION_ERROR'));

    const items = await readList(req.user.id);
    const exists = items.find(i => i.investorId === investorId);
    if (exists) return res.status(409).json(errorResponse('Investor already in watchlist', 'CONFLICT'));

    const now = new Date().toISOString();
    const entry: WatchlistEntry = { id: randomUUID(), investorId, notes: notes || '', priority: priority || 'medium', savedAt: now, updatedAt: now };
    items.unshift(entry);
    await writeList(req.user.id, items);

    const populatedList = await populateFounderWatchlist([entry]);
    return res.status(201).json(successResponse('Investor added to watchlist', populatedList[0]));
  } catch (error) {
    next(error);
  }
};

export const removeFromWatchlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await readList(req.user.id);
    const filtered = items.filter(i => i.id !== req.params.id && i.investorId !== req.params.id);
    if (filtered.length === items.length) return res.status(404).json(errorResponse('Watchlist entry not found', 'NOT_FOUND'));

    await writeList(req.user.id, filtered);
    return res.json(successResponse('Investor removed from watchlist'));
  } catch (error) {
    next(error);
  }
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
  } catch (error) {
    next(error);
  }
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
  } catch (error) {
    next(error);
  }
};
