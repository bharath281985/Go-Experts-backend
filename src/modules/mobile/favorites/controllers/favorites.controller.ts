import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

const favKey = (userId: string) => `favorites:${userId}`;

type FavItem = {
  id: string;
  entityType: string;
  entityId: string;
  note?: string | null;
  createdAt: string;
};

const loadFavorites = async (userId: string): Promise<FavItem[]> => {
  const row = await prisma.setting.findUnique({ where: { key: favKey(userId) } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveFavorites = async (userId: string, items: FavItem[]) => {
  await prisma.setting.upsert({
    where: { key: favKey(userId) },
    update: { value: JSON.stringify(items), category: 'favorites' },
    create: {
      key: favKey(userId),
      value: JSON.stringify(items),
      category: 'favorites',
    },
  });
};

export const addFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, note } = req.body;
    if (!entityType || !entityId) {
      return res
        .status(400)
        .json(errorResponse('entityType and entityId are required', 'VALIDATION_ERROR'));
    }
    const items = await loadFavorites(req.user.id);
    const existing = items.find(
      (i) => i.entityType === entityType && i.entityId === String(entityId)
    );
    if (existing) {
      return res.status(200).json(successResponse('Already in favorites', existing));
    }
    const item: FavItem = {
      id: uuidv4(),
      entityType: String(entityType),
      entityId: String(entityId),
      note: note || null,
      createdAt: new Date().toISOString(),
    };
    items.unshift(item);
    await saveFavorites(req.user.id, items);
    return res.status(201).json(successResponse('Added to favorites', item));
  } catch (error) {
    next(error);
  }
};

const populateFavorites = async (items: FavItem[]): Promise<any[]> => {
  return Promise.all(
    items.map(async (item) => {
      let details: any = null;
      try {
        if (item.entityType === 'founder' || item.entityType === 'startup') {
          // First try: look up in User table
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { id: item.entityId },
                { founderProfile: { id: item.entityId } }
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
          if (user) {
            details = {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              avatarUrl: user.avatarUrl,
              city: user.city,
              country: user.country,
              bio: user.bio,
              createdAt: user.createdAt,
              founderProfile: user.founderProfile
                ? {
                    id: user.founderProfile.id,
                    userId: user.id,
                    startupName: user.founderProfile.startupName,
                    industry: user.founderProfile.industry,
                    stage: user.founderProfile.stage,
                    raised: user.founderProfile.raised,
                    teamSize: user.founderProfile.teamSize,
                  }
                : null,
            };
          } else {
            const idea = await prisma.startupIdea.findFirst({
              where: { id: item.entityId, deletedAt: null },
            });
            if (idea) {
              const founderUser = await prisma.user.findFirst({
                where: { id: idea.founder, role: 'founder' },
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
                    },
                  },
                },
              });
              let founderInfo = null;
              if (founderUser) {
                founderInfo = {
                  id: founderUser.id,
                  fullName: founderUser.fullName,
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
              details = {
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
          }
        } else if (item.entityType === 'investor') {
          details = await prisma.user.findFirst({
            where: {
              OR: [
                { id: item.entityId },
                { investorProfile: { id: item.entityId } }
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
        } else if (item.entityType === 'freelancer') {
          details = await prisma.user.findFirst({
            where: {
              OR: [
                { id: item.entityId },
                { freelancerProfile: { id: item.entityId } }
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
              freelancerProfile: true,
            },
          });
        } else if (item.entityType === 'client') {
          details = await prisma.user.findFirst({
            where: {
              OR: [
                { id: item.entityId },
                { clientProfile: { id: item.entityId } }
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
              clientProfile: true,
            },
          });
        }
      } catch (e) {
        console.error('Error populating favorite details', e);
      }
      return details || item;
    })
  );
};

export const listFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const entityType = req.query.entityType as string | undefined;
    let items = await loadFavorites(req.user.id);
    if (entityType) items = items.filter((i) => i.entityType === entityType);
    const total = items.length;
    const skip = (page - 1) * limit;
    const slice = items.slice(skip, skip + limit);
    const populated = await populateFavorites(slice);
    return res.json(
      successResponse('Favorites', populated, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const removeFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const items = await loadFavorites(req.user.id);
    const nextItems = items.filter(
      (i) => i.id !== id && !(i.entityType + ':' + i.entityId === id)
    );
    // Also allow delete by entityType:entityId composite
    const { entityType, entityId } = req.query;
    const filtered =
      entityType && entityId
        ? items.filter(
            (i) => !(i.entityType === entityType && i.entityId === String(entityId))
          )
        : nextItems;
    await saveFavorites(req.user.id, filtered);
    return res.json(successResponse('Removed from favorites'));
  } catch (error) {
    next(error);
  }
};

export const updateFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { note } = req.body;
    const items = await loadFavorites(req.user.id);
    const idx = items.findIndex((i) => i.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json(errorResponse('Favorite not found', 'NOT_FOUND'));
    }
    items[idx] = { ...items[idx], note: note ?? items[idx].note };
    await saveFavorites(req.user.id, items);
    return res.json(successResponse('Favorite updated', items[idx]));
  } catch (error) {
    next(error);
  }
};

/** Toggle helper used by follow/save flows. */
export const toggleFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.body;
    if (!entityType || !entityId) {
      return res
        .status(400)
        .json(errorResponse('entityType and entityId are required', 'VALIDATION_ERROR'));
    }
    const items = await loadFavorites(req.user.id);
    const idx = items.findIndex(
      (i) => i.entityType === entityType && i.entityId === String(entityId)
    );
    if (idx >= 0) {
      items.splice(idx, 1);
      await saveFavorites(req.user.id, items);
      return res.json(successResponse('Removed from favorites', { favorited: false }));
    }
    const item: FavItem = {
      id: uuidv4(),
      entityType: String(entityType),
      entityId: String(entityId),
      note: null,
      createdAt: new Date().toISOString(),
    };
    items.unshift(item);
    await saveFavorites(req.user.id, items);
    return res.status(201).json(successResponse('Added to favorites', { favorited: true, ...item }));
  } catch (error) {
    next(error);
  }
};
