import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { shapeProjects } from '../../../../services/mobile/project-shape.service.js';

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
              registrationData: true,
              investorProfile: true,
            },
          });
          if (details) {
            const rawCountry = String(details.country || '').trim();
            const focusAreaIds = String(details.investorProfile?.focusAreas || '')
              .split(',').map((value: string) => value.trim()).filter(Boolean);
            const [country, focusOptions, focusCategories, focusIndustries, focusSkills, projectCategories] = await Promise.all([
              rawCountry ? prisma.country.findFirst({
                where: { OR: [{ id: rawCountry }, { name: rawCountry }, { code: rawCountry }] },
                select: { id: true, name: true },
              }).catch(() => null) : null,
              (prisma as any).masterOption?.findMany({
                where: { OR: [{ id: { in: focusAreaIds } }, { value: { in: focusAreaIds } }, { label: { in: focusAreaIds } }] },
                select: { id: true, value: true, label: true },
              }).catch(() => []) || [],
              prisma.skillCategory.findMany({ where: { id: { in: focusAreaIds } }, select: { id: true, name: true } }).catch(() => []),
              prisma.industry.findMany({ where: { id: { in: focusAreaIds } }, select: { id: true, name: true } }).catch(() => []),
              prisma.skill.findMany({ where: { id: { in: focusAreaIds } }, select: { id: true, name: true } }).catch(() => []),
              (prisma as any).projectCategory?.findMany({ where: { id: { in: focusAreaIds } }, select: { id: true, name: true } }).catch(() => []) || [],
            ]);
            const focusNameMap = new Map<string, string>();
            focusOptions.forEach((option: any) => {
              focusNameMap.set(option.id, option.label);
              if (option.value) focusNameMap.set(option.value, option.label);
            });
            [...focusCategories, ...focusIndustries, ...focusSkills, ...projectCategories]
              .forEach((option: any) => focusNameMap.set(option.id, option.name));
            const registrationData: any = typeof details.registrationData === 'string'
              ? (() => { try { return JSON.parse(details.registrationData); } catch { return {}; } })()
              : (details.registrationData || {});
            const registrationFocusAreas = Array.isArray(registrationData.focusAreas) ? registrationData.focusAreas : [];
            const focusAreas = focusAreaIds.map((id: string, index: number) =>
              focusNameMap.get(id)
              || (/^[0-9a-f-]{36}$/i.test(String(registrationFocusAreas[index] || '')) ? '' : registrationFocusAreas[index])
              || ''
            );
            details = {
              ...details,
              registrationData: undefined,
              country: country?.name || rawCountry,
              countryId: country?.id || rawCountry,
              investorProfile: details.investorProfile ? {
                ...details.investorProfile,
                focusAreas: undefined,
                FocusAreas: focusAreaIds.map((id: string, index: number) => ({
                  focusAreaId: id,
                  focusAreaName: focusAreas[index],
                })),
              } : null,
            };
          }
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
        } else if (item.entityType === 'project') {
          const project = await prisma.project.findFirst({
            where: { id: item.entityId, deletedAt: null },
          });
          if (project) {
            const shaped = await shapeProjects([project]);
            details = shaped[0] || project;
          }
        }
      } catch (e) {
        console.error('Error populating favorite details', e);
      }
      return {
        // Favorite metadata
        favoriteId: item.id,
        entityType: item.entityType,
        entityId: item.entityId,
        note: item.note,
        favoritedAt: item.createdAt,
        isSaved: true,

        // Flat details at root level
        ...(details || {}),

        // Nested helper keys for backward compatibility
        details: details || null,
        project: item.entityType === 'project' ? details : null,
        investor: item.entityType === 'investor' ? details : null,
        founder: item.entityType === 'founder' || item.entityType === 'startup' ? details : null,
        freelancer: item.entityType === 'freelancer' ? details : null,
        client: item.entityType === 'client' ? details : null,
      };
    })
  );
};

export const listFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const entityType = req.query.entityType as string | undefined;

    // 1. Load primary favorites
    let allItems = await loadFavorites(req.user.id);

    // 2. Merge legacy stored items for all roles & entities seamlessly
    const legacyKeys = [
      { key: `saved_freelancers:${req.user.id}`, entityType: 'freelancer', idField: (x: any) => x.freelancerId || x.id },
      { key: `saved_projects:${req.user.id}`, entityType: 'project', idField: (x: any) => x.projectId || x.id },
      { key: `investor_watchlist:${req.user.id}`, entityType: 'startup', idField: (x: any) => x.startupId || x.id },
      { key: `founder_investor_watchlist:${req.user.id}`, entityType: 'investor', idField: (x: any) => x.investorId || x.id },
      { key: `investor_watchlist_founders:${req.user.id}`, entityType: 'founder', idField: (x: any) => x.founderId || x.startupId || x.id },
    ];

    for (const l of legacyKeys) {
      if (!entityType || entityType === l.entityType) {
        try {
          const row = await prisma.setting.findUnique({ where: { key: l.key } });
          if (row?.value) {
            const parsed = JSON.parse(row.value);
            if (Array.isArray(parsed)) {
              for (const p of parsed) {
                const entityId = String(l.idField(p) || '');
                if (entityId && !allItems.some(i => i.entityType === l.entityType && i.entityId === entityId)) {
                  allItems.push({
                    id: p.id || uuidv4(),
                    entityType: l.entityType,
                    entityId: entityId,
                    note: p.notes || p.note || null,
                    createdAt: p.savedAt || p.createdAt || new Date().toISOString(),
                  });
                }
              }
            }
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    if (entityType) {
      allItems = allItems.filter((i) => i.entityType === entityType);
    }

    const total = allItems.length;
    const skip = (page - 1) * limit;
    const slice = allItems.slice(skip, skip + limit);
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
