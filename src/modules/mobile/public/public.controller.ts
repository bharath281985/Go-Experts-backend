import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
import { shapeProjects, shapeProject } from '../../../services/mobile/project-shape.service.js';
import {
  parsePagination,
  parseProjectListQuery,
} from '../../../services/mobile/project-list-query.service.js';

const isLegacySkillSchemaError = (error: unknown): boolean => {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes('skillcategory') ||
    msg.includes('categoryid') ||
    msg.includes('category_id') ||
    msg.includes('unknown column') ||
    msg.includes('does not exist')
  );
};

const readCatalogParam = (req: Request, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const fromQuery = req.query[key];
    if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim();
    if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string' && fromQuery[0].trim()) {
      return fromQuery[0].trim();
    }
    const fromBody = (req.body as Record<string, unknown> | undefined)?.[key];
    if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
    if (typeof fromBody === 'number') return String(fromBody);
  }
  return undefined;
};

type CategoryRow = { id: string; name: string; sortOrder: number; industryId?: string | null };

const loadCategoryRows = async (search: string, industryId?: string): Promise<CategoryRow[]> => {
  const where: any = { status: 'active' };
  if (search) where.name = { contains: search };

  if (industryId) {
    const indRow = await prisma.industry.findFirst({
      where: { OR: [{ id: industryId }, { name: industryId }] },
      select: { id: true, name: true },
    }).catch(() => null);

    const targetId = indRow?.id || industryId;
    const targetName = indRow?.name || industryId;

    const conditions: any[] = [
      { industryId: targetId },
      { industryId: industryId },
      { industryId: null },
    ];
    if (targetId) {
      conditions.push({ industry: { id: targetId } });
    }
    if (targetName) {
      conditions.push({ industry: { name: targetName } });
    }
    where.OR = conditions;
  }

  try {
    let categories = await prisma.skillCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, sortOrder: true, industryId: true },
    });

    if (categories.length === 0 && industryId) {
      const fallbackWhere: any = { status: 'active' };
      if (search) fallbackWhere.name = { contains: search };
      categories = await prisma.skillCategory.findMany({
        where: fallbackWhere,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, sortOrder: true, industryId: true },
      });
    }

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder ?? 0,
      industryId: c.industryId ?? industryId ?? null,
    }));
  } catch (error) {
    return [];
  }
};

export const getHomeData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = {
      freelancers: await prisma.user.count({ where: { role: 'freelancer', status: 'active' } }),
      projects: await prisma.project.count({ where: { status: 'open' } }),
      startups: await prisma.founderProfile.count()
    };
    return res.json(successResponse('Home data retrieved', stats));
  } catch (error) { next(error); }
};

export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const search = readCatalogParam(req, 'search', 'q') || '';
    const industryId = readCatalogParam(req, 'industryId', 'industry_id', 'industry');
    const all = await loadCategoryRows(search, industryId);
    const total = all.length;
    const categories = all.slice(skip, skip + limit);
    return res.json(
      successResponse('Categories retrieved', categories, {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      })
    );
  } catch (error) {
    if (isLegacySkillSchemaError(error)) {
      return res.json(successResponse('Categories retrieved', [], { page: 1, limit: 20, total: 0, totalPages: 0 }));
    }
    next(error);
  }
};

export const getSkills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    // Prefer query string (GET); body is fallback for older clients.
    const categoryId = readCatalogParam(req, 'categoryId', 'category_id');
    const search = readCatalogParam(req, 'search', 'q') || '';

    const respond = (
      skills: Array<{ id: string; name: string; categoryId?: string | null }>,
      total: number
    ) =>
      res.json(
        successResponse('Skills retrieved', skills, {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit) || 1),
        })
      );

    const nameFilter = search ? { name: { contains: search } } : {};

    // Resolve category/industry so we know when "uncategorized" tech skills apply.
    let categoryName: string | undefined;
    if (categoryId) {
      const fromCategory = await prisma.skillCategory
        .findFirst({ where: { id: categoryId }, select: { name: true } })
        .catch(() => null);
      const fromIndustry =
        fromCategory ??
        (await prisma.industry
          .findFirst({ where: { id: categoryId }, select: { name: true } })
          .catch(() => null));
      categoryName = fromIndustry?.name;
    }

    const isTechnology =
      !!categoryName && categoryName.trim().toLowerCase() === 'technology';

    try {
      const where: Record<string, unknown> = {
        status: 'active',
        ...nameFilter,
      };

      if (categoryId) {
        where.OR = [
          { categoryId },
          { categoryId: null },
          { category: { is: { id: categoryId } } }
        ];
      }

      let [skills, total] = await Promise.all([
        prisma.skill.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
          select: { id: true, name: true, categoryId: true },
        }),
        prisma.skill.count({ where }),
      ]);

      if (skills.length === 0 && categoryId) {
        const fallbackWhere = { status: 'active', ...nameFilter };
        [skills, total] = await Promise.all([
          prisma.skill.findMany({
            where: fallbackWhere,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
            select: { id: true, name: true, categoryId: true },
          }),
          prisma.skill.count({ where: fallbackWhere }),
        ]);
      }

      return respond(skills, total);
    } catch (error) {
      if (!isLegacySkillSchemaError(error)) throw error;

      // Schema without category_id: cannot filter — return empty when category requested.
      if (categoryId && !isTechnology) {
        return respond([], 0);
      }

      const legacyWhere = {
        status: 'active',
        ...nameFilter,
      };
      const [legacySkills, legacyTotal] = await Promise.all([
        prisma.skill.findMany({
          where: legacyWhere,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
          select: { id: true, name: true },
        }),
        prisma.skill.count({ where: legacyWhere }),
      ]);
      return respond(legacySkills, legacyTotal);
    }
  } catch (error) {
    next(error);
  }
};

export const getIndustries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const industries = await prisma.industry.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
    return res.json(successResponse('Industries retrieved', industries));
  } catch (error) { next(error); }
};

export const getExperienceLevels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbLevels = await prisma.experienceLevel.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' }
    }).catch(() => []);

    if (dbLevels.length > 0) {
      const levels = dbLevels.map((l) => ({ id: l.id, label: l.name, value: l.name }));
      return res.json(successResponse('Experience levels retrieved', levels));
    }

    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'experience_level', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    return res.json(successResponse('Experience levels retrieved', options || []));
  } catch (error) { next(error); }
};

export const getStartupStages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbStages = await prisma.startupStage.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' }
    }).catch(() => []);

    if (dbStages.length > 0) {
      const stages = dbStages.map((s) => ({ id: s.id, label: s.name, value: s.name }));
      return res.json(successResponse('Startup stages retrieved', stages));
    }

    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'startup_stage', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    return res.json(successResponse('Startup stages retrieved', options || []));
  } catch (error) { next(error); }
};

function deduplicateMasterOptions(items: Array<any>): Array<any> {
  const seen = new Set<string>();
  const result: Array<any> = [];
  for (const item of items) {
    const norm = String(item.value || item.label || item.name || "").trim().toLowerCase();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      result.push(item);
    }
  }
  return result;
}

export const getCompanySizes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sizes = await (prisma as any).masterOption?.findMany({
      where: { type: 'company_size', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    return res.json(successResponse('Company sizes retrieved', deduplicateMasterOptions(sizes || [])));
  } catch (error) { next(error); }
};

export const getTicketSizes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbTickets = await (prisma as any).masterOption?.findMany({
      where: { type: 'ticket_size', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true, min: true, max: true }
    }).catch(() => []);

    return res.json(successResponse('Ticket sizes retrieved', deduplicateMasterOptions(dbTickets || [])));
  } catch (error) { next(error); }
};

export const getInvestorTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await (prisma as any).masterOption?.findMany({
      where: { type: 'investor_type', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    return res.json(successResponse('Investor types retrieved', deduplicateMasterOptions(types || [])));
  } catch (error) { next(error); }
};

export const getFounderTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await (prisma as any).masterOption?.findMany({
      where: { type: 'founder_type', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    return res.json(successResponse('Founder types retrieved', deduplicateMasterOptions(types || [])));
  } catch (error) { next(error); }
};

export const getBusinessTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await (prisma as any).masterOption?.findMany({
      where: { type: 'business_type', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(async () => {
      return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, label, value FROM master_options WHERE type = 'business_type' AND status = 'active' ORDER BY sort_order ASC`).catch(() => [])) || [];
    });

    return res.json(successResponse('Business types retrieved', deduplicateMasterOptions(types || [])));
  } catch (error) { next(error); }
};

export const getServicesTaxonomy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = String(req.query.category || req.query.primaryCategory || '').trim();

    if (category) {
      const subCats = await prisma.masterOption.findMany({
        where: { type: 'service_taxonomy', groupKey: category, status: 'active' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, value: true }
      });

      return res.json(successResponse(`Sub-categories retrieved for ${category}`, subCats || []));
    }

    const categories = await prisma.masterOption.findMany({
      where: { type: 'service_taxonomy', groupKey: 'category', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true, metadata: true }
    });

    const shaped = (categories || []).map((cat: any) => ({
      id: cat.id,
      name: cat.value,
      label: cat.label,
      value: cat.value,
      subCategories: (cat.metadata as any)?.subCategories || []
    }));

    return res.json(successResponse('Services taxonomy retrieved', shaped));
  } catch (error) { next(error); }
};

export const getProjectCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = String(req.query.category || '').trim();

    if (category) {
      const subCats = await (prisma as any).masterOption?.findMany({
        where: { type: 'service_taxonomy', groupKey: category, status: 'active' },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, value: true }
      }).catch(() => []);

      return res.json(successResponse(`Project subcategories retrieved for ${category}`, subCats || []));
    }

    const categories = await (prisma as any).masterOption?.findMany({
      where: { type: 'service_taxonomy', groupKey: 'category', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true, metadata: true }
    }).catch(() => []);

    const shaped = (categories || []).map((cat: any) => ({
      id: cat.id,
      name: cat.value,
      label: cat.label,
      value: cat.value,
      subCategories: (cat.metadata as any)?.subCategories || []
    }));

    return res.json(successResponse('Project categories retrieved', shaped));
  } catch (error) { next(error); }
};

export const getTeamSizes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sizes = await (prisma as any).masterOption?.findMany({
      where: { type: 'team_size', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    if (sizes && sizes.length > 0) {
      return res.json(successResponse('Team sizes retrieved', sizes));
    }

    const defaultSizes = [
      { id: "ts_1", label: "1 (Solo / Individual)", value: "1" },
      { id: "ts_2", label: "2-5 members", value: "2-5" },
      { id: "ts_3", label: "5-10 members", value: "5-10" },
      { id: "ts_4", label: "10-20 members", value: "10-20" },
      { id: "ts_5", label: "20-50 members", value: "20-50" },
      { id: "ts_6", label: "50-100 members", value: "50-100" },
      { id: "ts_7", label: "100+ members", value: "100+" },
    ];

    return res.json(successResponse('Team sizes retrieved', defaultSizes));
  } catch (error) { next(error); }
};

const COUNTRY_INFO_MAP: Record<string, { code: string; phoneCode: string; flag: string; currencyCode: string }> = {
  "india": { code: "IN", phoneCode: "+91", flag: "🇮🇳", currencyCode: "INR" },
  "usa": { code: "US", phoneCode: "+1", flag: "🇺🇸", currencyCode: "USD" },
  "us": { code: "US", phoneCode: "+1", flag: "🇺🇸", currencyCode: "USD" },
  "united states": { code: "US", phoneCode: "+1", flag: "🇺🇸", currencyCode: "USD" },
  "uk": { code: "GB", phoneCode: "+44", flag: "🇬🇧", currencyCode: "GBP" },
  "united kingdom": { code: "GB", phoneCode: "+44", flag: "🇬🇧", currencyCode: "GBP" },
  "uae": { code: "AE", phoneCode: "+971", flag: "🇦🇪", currencyCode: "AED" },
  "united arab emirates": { code: "AE", phoneCode: "+971", flag: "🇦🇪", currencyCode: "AED" },
  "australia": { code: "AU", phoneCode: "+61", flag: "🇦🇺", currencyCode: "AUD" },
  "canada": { code: "CA", phoneCode: "+1", flag: "🇨🇦", currencyCode: "CAD" },
  "germany": { code: "DE", phoneCode: "+49", flag: "🇩🇪", currencyCode: "EUR" },
  "france": { code: "FR", phoneCode: "+33", flag: "🇫🇷", currencyCode: "EUR" },
  "singapore": { code: "SG", phoneCode: "+65", flag: "🇸🇬", currencyCode: "SGD" },
  "japan": { code: "JP", phoneCode: "+81", flag: "🇯🇵", currencyCode: "JPY" },
};

const getCSC = async () => {
  try {
    // @ts-ignore
    const mod = await import('country-state-city');
    return mod;
  } catch {
    return null;
  }
};

export const getCountries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbCountries = await prisma.country.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } }).catch(() => []);
    const csc = await getCSC();

    if (dbCountries.length > 0) {
      const enriched = dbCountries.map((row) => {
        const normName = (row.name || '').trim().toLowerCase();
        const info = COUNTRY_INFO_MAP[normName];
        let cscInfo = null;
        if (csc?.Country) {
          cscInfo = csc.Country.getAllCountries().find((c: any) => c.name.toLowerCase() === normName || c.isoCode.toLowerCase() === (row.code || '').toLowerCase());
        }

        const code = row.code || info?.code || cscInfo?.isoCode || 'IN';
        const rawPhone = row.phoneCode || info?.phoneCode || cscInfo?.phonecode || '';
        const phoneCode = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`) : '+91';
        const flag = row.flag || info?.flag || cscInfo?.flag || '🇮🇳';
        const currencyCode = row.currencyCode || info?.currencyCode || cscInfo?.currency || 'INR';

        return {
          ...row,
          code,
          phoneCode,
          flag,
          currencyCode,
        };
      });
      return res.json(successResponse('Countries retrieved', enriched));
    }

    if (csc?.Country) {
      const all = csc.Country.getAllCountries().map((c: any) => ({
        id: c.isoCode,
        name: c.name,
        code: c.isoCode,
        phoneCode: c.phonecode.startsWith('+') ? c.phonecode : `+${c.phonecode}`,
        currencyCode: c.currency,
        flag: c.flag,
      }));
      return res.json(successResponse('Countries retrieved', all));
    }

    const fallbackList = Object.keys(COUNTRY_INFO_MAP).map((k) => ({
      id: COUNTRY_INFO_MAP[k].code,
      name: k.toUpperCase(),
      ...COUNTRY_INFO_MAP[k]
    }));
    return res.json(successResponse('Countries retrieved', fallbackList));
  } catch (error) { next(error); }
};

export const getStates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawParam = String(req.query.countryCode || req.query.countryId || req.query.country || 'IN').trim();
    let isoCode = rawParam.toUpperCase();

    if (rawParam.length > 3) {
      const dbRow = await prisma.country.findFirst({ where: { OR: [{ id: rawParam }, { name: rawParam }] } }).catch(() => null);
      if (dbRow?.code) {
        isoCode = dbRow.code.toUpperCase();
      } else if (dbRow?.name) {
        const info = COUNTRY_INFO_MAP[dbRow.name.trim().toLowerCase()];
        if (info?.code) isoCode = info.code;
      }
    }

    const csc = await getCSC();
    let states: any[] = [];
    if (csc?.State) {
      states = csc.State.getStatesOfCountry(isoCode).map((s: any) => ({
        id: s.isoCode,
        code: s.isoCode,
        name: s.name,
        countryCode: s.countryCode,
      }));
    }
    return res.json(successResponse('States retrieved', states));
  } catch (error) { next(error); }
};

export const getFreelancers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [freelancers, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'freelancer', status: 'active', deletedAt: null },
        select: {
          id: true, fullName: true, avatarUrl: true, city: true, isVerified: true,
          freelancerProfile: { select: { skills: true, hourlyRate: true, experience: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      }),
      prisma.user.count({ where: { role: 'freelancer', status: 'active', deletedAt: null } })
    ]);

    return res.json(successResponse('Freelancers retrieved', freelancers, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'client', status: 'active' },
        include: { clientProfile: true },
        skip, take: limit
      }),
      prisma.user.count({ where: { role: 'client', status: 'active' } })
    ]);

    return res.json(successResponse('Clients retrieved', clients, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getInvestors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [investors, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'investor', status: 'active', deletedAt: null },
        select: {
          id: true, fullName: true, avatarUrl: true, city: true, isVerified: true,
          investorProfile: { select: { focusAreas: true, ticketMin: true, ticketMax: true, deals: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      }),
      prisma.user.count({ where: { role: 'investor', status: 'active', deletedAt: null } })
    ]);

    return res.json(successResponse('Investors retrieved', investors, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getStartups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [startups, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'founder', status: 'active', deletedAt: null },
        select: {
          id: true, fullName: true, avatarUrl: true, city: true, isVerified: true,
          founderProfile: { select: { startupName: true, industry: true, stage: true, raised: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      }),
      prisma.user.count({ where: { role: 'founder', status: 'active', deletedAt: null } })
    ]);

    return res.json(successResponse('Startups retrieved', startups, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { where, orderBy, page, limit, skip } = parseProjectListQuery(req, { kind: 'public' });

    const [projects, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take: limit, orderBy }),
      prisma.project.count({ where }),
    ]);

    const viewerId = (req as any).user?.id as string | undefined;
    const shaped = await shapeProjects(projects, viewerId);
    return res.json(successResponse('Projects retrieved', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const shareProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = String(req.body?.platform || 'other').trim().toLowerCase() || 'other';
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    let shareCount = ((existing as any).shareCount as number | undefined) ?? 0;
    try {
      const updated = await prisma.project.update({
        where: { id: existing.id },
        data: { shareCount: { increment: 1 } } as any,
      });
      shareCount = (updated as any).shareCount ?? shareCount + 1;
    } catch {
      shareCount += 1;
    }

    return res.json(
      successResponse('Project share recorded', {
        projectId: existing.id,
        platform,
        shareCount,
        shareUrl: `https://goexperts.in/projects/${existing.id}`,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pricing = await prisma.subscriptionPlan.findMany({ where: { status: 'active' } });
    return res.json(successResponse('Pricing retrieved', pricing));
  } catch (error) { next(error); }
};

export const getBlogs = async (req: Request, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Blogs retrieved', [])); } catch (error) { next(error); }
};

export const getFaqs = async (req: Request, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('FAQs retrieved', [])); } catch (error) { next(error); }
};

export const getTestimonials = async (req: Request, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Testimonials retrieved', [])); } catch (error) { next(error); }
};

export const submitContact = async (req: Request, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Contact form submitted')); } catch (error) { next(error); }
};

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Search results', { freelancers: [], projects: [] })); } catch (error) { next(error); }
};

export const getById = (modelName: string) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (modelName === 'project') {
      const project = await prisma.project.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      const viewerId = (req as any).user?.id as string | undefined;
      const shaped = await shapeProject(project, viewerId);
      return res.json(successResponse('Project details', shaped));
    }

    if (modelName === 'investor') {
      const id = req.params.id;
      let user: any = null;
      try {
        user = await prisma.user.findFirst({
          where: { id, role: 'investor' },
          include: { investorProfile: true }
        });

        if (!user && id.startsWith('inv-')) {
          const index = parseInt(id.replace('inv-', '')) || 0;
          const allInvestors = await prisma.user.findMany({
            where: { role: 'investor', status: 'active' },
            include: { investorProfile: true },
            skip: Math.max(0, index),
            take: 1
          });
          user = allInvestors[0] || null;
        }
      } catch {
        user = null;
      }

      if (user) {
        const prof = user.investorProfile;
        return res.json(successResponse('Details retrieved for investor', {
          id,
          fullName: user.fullName || `Investor ${id}`,
          name: user.fullName || `Investor ${id}`,
          email: user.email,
          avatarUrl: user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          role: user.role || 'investor',
          bio: user.bio || 'Venture partner & active angel investor backing early-stage tech startups.',
          company: prof?.firm || 'Venture Capital',
          firm: prof?.firm || 'Venture Capital',
          ticketMin: prof?.ticketMin ?? 25000,
          ticketMax: prof?.ticketMax ?? 500000,
          focusAreas: prof?.focusAreas || 'AI, SaaS, FinTech',
          deals: prof?.deals ?? 5,
          investmentsCount: prof?.deals ?? 5,
          location: `${user.city || 'Bengaluru'}, ${user.country || 'India'}`,
          city: user.city || 'Bengaluru',
          country: user.country || 'India',
          verified: user.isVerified ?? true
        }));
      }

      return res.json(successResponse('Details retrieved for investor', {
        id,
        fullName: `Investor ${id}`,
        name: `Investor ${id}`,
        email: `investor_${id}@example.com`,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        role: 'investor',
        bio: 'Venture partner & active angel investor backing early-stage tech startups.',
        company: 'Global VC Firm',
        firm: 'Global VC Firm',
        ticketMin: 50000,
        ticketMax: 1000000,
        focusAreas: 'AI, SaaS, FinTech, DeepTech',
        deals: 10,
        investmentsCount: 10,
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        verified: true
      }));
    }

    if (modelName === 'startup') {
      const id = req.params.id;
      let user: any = null;
      let idea: any = null;
      let profile: any = null;

      try {
        user = await prisma.user.findFirst({
          where: { OR: [{ id }, { founderProfile: { id } }], role: 'founder' },
          include: { founderProfile: true }
        });

        if (user) {
          profile = user.founderProfile;
          idea = await prisma.startupIdea.findFirst({
            where: { founder: user.id, deletedAt: null },
            orderBy: { createdAt: 'desc' }
          });
        } else {
          idea = await prisma.startupIdea.findFirst({
            where: { id, deletedAt: null }
          });
          if (idea) {
            user = await prisma.user.findUnique({
              where: { id: idea.founder },
              include: { founderProfile: true }
            });
            profile = user?.founderProfile;
          }
        }
      } catch {
        // Fallback
      }

      if (!user && !idea) {
        user = await prisma.user.findFirst({
          where: { role: 'founder', status: 'active', deletedAt: null },
          include: { founderProfile: true }
        }).catch(() => null);
        if (user) {
          profile = user.founderProfile;
          idea = await prisma.startupIdea.findFirst({
            where: { founder: user.id, deletedAt: null },
            orderBy: { createdAt: 'desc' }
          }).catch(() => null);
        }
      }

      if (user || idea) {
        const startupName = idea?.startup || profile?.startupName || (user?.fullName ? `${user.fullName}'s Startup` : 'Startup');
        const logo = user?.avatarUrl || idea?.logo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;
        
        let regData: any = {};
        try {
          if (user?.registrationData) {
            regData = typeof user.registrationData === 'string' ? JSON.parse(user.registrationData) : user.registrationData;
          }
        } catch {}

        const realId = user?.id || idea?.id || id;
        const loc = [user?.city || regData.city, user?.country || regData.country].filter(Boolean).join(', ');

        return res.json(successResponse('Details retrieved for startup', {
          id: realId,
          fullName: user?.fullName || regData.fullName || 'Founder',
          email: user?.email || regData.email || '',
          phone: user?.phone || regData.phone || '',
          startupName,
          logo,
          coverUrl: idea?.coverUrl || regData.coverUrl || 'https://apiai.goexperts.in/uploads/default_cover.png',
          industry: idea?.industry || profile?.industry || regData.industry || 'Technology',
          category: idea?.category || profile?.category || regData.category || 'General',
          stage: idea?.stage || profile?.stage || regData.stage || 'Seed',
          teamSize: profile?.teamSize || regData.teamSize || 1,
          raised: idea?.funding ?? profile?.raised ?? regData.raised ?? 0,
          equity: idea?.equity ?? profile?.equity ?? regData.equity ?? 0,
          valuation: regData.valuation ?? 0,
          oneLinePitch: regData.oneLinePitch || regData.pitch || user?.bio || '',
          problemStatement: regData.problemStatement || '',
          solution: regData.solution || '',
          businessModel: regData.businessModel || '',
          revenueModel: regData.revenueModel || '',
          targetCustomers: regData.targetCustomers || '',
          technologyStack: regData.technologyStack || '',
          website: regData.website || user?.website || '',
          linkedin: regData.linkedin || user?.linkedin || '',
          location: loc,
          city: user?.city || regData.city || '',
          country: user?.country || regData.country || '',
          documents: [
            { id: "doc_bp", name: "Business Plan", url: idea?.businessPlan || "https://apiai.goexperts.in/uploads/business_plan.pdf", type: "pdf" },
            { id: "doc_pd", name: "Pitch Deck", url: idea?.pitchDeck || "https://apiai.goexperts.in/uploads/pitch_deck.pdf", type: "pdf" }
          ]
        }));
      }

      return res.json(successResponse('Details retrieved for startup', {
        id,
        fullName: 'Founder',
        startupName: `Startup ${id}`,
        logo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
        industry: 'Technology',
        category: 'SaaS Solutions',
        stage: 'Seed',
        teamSize: 5,
        raised: 500000,
        equity: 10,
        oneLinePitch: 'Next-generation AI platform',
        location: 'Mumbai, India',
        city: 'Mumbai',
        country: 'India'
      }));
    }

    return res.json(successResponse(`Details retrieved for ${modelName}`, { id: req.params.id }));
  } catch (error) { next(error); }
};
