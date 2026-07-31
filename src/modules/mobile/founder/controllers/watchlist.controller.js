import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
const watchlistKey = (userId) => `founder_investor_watchlist:${userId}`;
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
    await prisma.setting.upsert({
        where: { key },
        update: { value: JSON.stringify(items), category: 'founder_investor_watchlist' },
        create: { key, value: JSON.stringify(items), category: 'founder_investor_watchlist' },
    });
};
export const getWatchlist = async (req, res, next) => {
    try {
        const items = await readList(req.user.id);
        return res.json(successResponse('Watchlist retrieved', items, { total: items.length }));
    }
    catch (error) {
        next(error);
    }
};
export const addToWatchlist = async (req, res, next) => {
    try {
        const investorId = req.body.investorId || req.body.startupId;
        const { notes, priority } = req.body;
        if (!investorId)
            return res.status(400).json(errorResponse('investorId or startupId is required', 'VALIDATION_ERROR'));
        const items = await readList(req.user.id);
        const exists = items.find(i => i.investorId === investorId);
        if (exists)
            return res.status(409).json(errorResponse('Investor already in watchlist', 'CONFLICT'));
        const now = new Date().toISOString();
        const entry = { id: randomUUID(), investorId, notes: notes || '', priority: priority || 'medium', savedAt: now, updatedAt: now };
        items.unshift(entry);
        await writeList(req.user.id, items);
        return res.status(201).json(successResponse('Investor added to watchlist', entry));
    }
    catch (error) {
        next(error);
    }
};
export const removeFromWatchlist = async (req, res, next) => {
    try {
        const items = await readList(req.user.id);
        const filtered = items.filter(i => i.id !== req.params.id && i.investorId !== req.params.id);
        if (filtered.length === items.length)
            return res.status(404).json(errorResponse('Watchlist entry not found', 'NOT_FOUND'));
        await writeList(req.user.id, filtered);
        return res.json(successResponse('Investor removed from watchlist'));
    }
    catch (error) {
        next(error);
    }
};
export const updateWatchlistNotes = async (req, res, next) => {
    try {
        const { notes } = req.body;
        const items = await readList(req.user.id);
        const idx = items.findIndex(i => i.id === req.params.id);
        if (idx < 0)
            return res.status(404).json(errorResponse('Watchlist entry not found', 'NOT_FOUND'));
        items[idx] = { ...items[idx], notes, updatedAt: new Date().toISOString() };
        await writeList(req.user.id, items);
        return res.json(successResponse('Notes updated', items[idx]));
    }
    catch (error) {
        next(error);
    }
};
export const updateWatchlistPriority = async (req, res, next) => {
    try {
        const { priority } = req.body;
        const items = await readList(req.user.id);
        const idx = items.findIndex(i => i.id === req.params.id);
        if (idx < 0)
            return res.status(404).json(errorResponse('Watchlist entry not found', 'NOT_FOUND'));
        items[idx] = { ...items[idx], priority, updatedAt: new Date().toISOString() };
        await writeList(req.user.id, items);
        return res.json(successResponse('Priority updated', items[idx]));
    }
    catch (error) {
        next(error);
    }
};
