import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { shapeProjects, shapeProject } from '../../../services/mobile/project-shape.service.js';
import {
  parsePagination,
  parseProjectListQuery,
} from '../../../services/mobile/project-list-query.service.js';

const oneOrMany = <T>(items: T[]): T | T[] => items.length === 1 ? items[0] : items;

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
      projects: await prisma.project.count({ where: { status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] } } }),
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
    const reqCategoryId = readCatalogParam(req, 'categoryId', 'category_id');
    const reqIndustryId = readCatalogParam(req, 'industryId', 'industry_id', 'industry');
    const search = readCatalogParam(req, 'search', 'q') || '';

    const respond = (
      skills: Array<{ id: string; name: string; categoryId?: string | null; industryId?: string | null }>,
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

    const where: any = {
      status: 'active',
      ...nameFilter,
    };

    let indId: string | undefined = undefined;
    let indName: string | undefined = undefined;

    if (reqCategoryId) {
      where.categoryId = reqCategoryId;
    } else if (reqIndustryId) {
      const targetIndustry = await prisma.industry.findFirst({
        where: {
          OR: [
            { id: reqIndustryId },
            { name: reqIndustryId },
            { name: { contains: reqIndustryId } }
          ]
        }
      }).catch(() => null);

      indId = targetIndustry?.id || reqIndustryId;
      indName = targetIndustry?.name || reqIndustryId;

      if (indId || indName) {
        where.OR = [
          { industry: indId },
          { industry: indName },
          { categoryId: indId },
          { category: { is: { industryId: indId } } },
          { category: { is: { name: { contains: indName } } } }
        ];
      }
    }

    let [skills, total]: [any[], number] = await Promise.all([
      prisma.skill.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: { id: true, name: true, categoryId: true, industry: true, category: { select: { industryId: true } } },
      }),
      prisma.skill.count({ where }),
    ]).catch(() => [[], 0] as [any[], number]);



    const result = skills.map((s: any) => {
      let finalIndustryId = null;
      if (s.category?.industryId) finalIndustryId = s.category.industryId;
      else if (s.industry && s.industry.length === 36) finalIndustryId = s.industry;
      else if (reqIndustryId && indId) finalIndustryId = indId;

      return {
        id: s.id,
        name: s.name,
        categoryId: s.categoryId || null,
        industryId: finalIndustryId
      };
    });

    return respond(result, total);
  } catch (error) {
    next(error);
  }
};

export const getIndustries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbIndustries = await prisma.industry.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    });

    const industries = dbIndustries.map((ind) => ({ id: ind.id, name: ind.name }));
    return res.json(successResponse('Industries retrieved', industries));
  } catch (error) {
    next(error);
  }
};

export const getExperienceLevels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'experience_level', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    if (options && options.length > 0) {
      return res.json(successResponse('Experience levels retrieved', options));
    }

    const dbLevels = await prisma.experienceLevel.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' }
    }).catch(() => []);

    const levels = dbLevels.map((l) => ({ id: l.id, label: l.name, value: l.name }));
    return res.json(successResponse('Experience levels retrieved', levels));
  } catch (error) { next(error); }
};

export const getStartupStages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = await prisma.masterOption.findMany({
      where: { type: 'startup_stage', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(async () => {
      return prisma.$queryRawUnsafe<Array<{ id: string; label: string; value: string }>>(
        "SELECT id, label, value FROM master_options WHERE type = 'startup_stage' AND status = 'active' ORDER BY sort_order ASC"
      ).catch(() => []);
    });

    const seen = new Set<string>();
    const stages = options.filter((option) => {
      const key = String(option.value || option.label || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return res.json({ success: true, data: stages });
  } catch (error) { next(error); }
};

export const getAvailabilityOptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbOptions = await (prisma as any).masterOption?.findMany({
      where: { type: { in: ['availability', 'freelancer_availability'] }, status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    const mapped = (dbOptions || []).map((o: any) => ({
      id: o.id,
      name: o.label || o.value
    }));

    return res.json(successResponse('Availabilities retrieved', mapped));
  } catch (error) { next(error); }
};

export const getWorkModes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbModes = await prisma.workMode.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' }
    }).catch(() => []);

    if (dbModes.length > 0) {
      const modes = dbModes.map((m) => ({ id: m.id, label: m.name, value: m.name }));
      return res.json(successResponse('Work modes retrieved', modes));
    }

    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'work_mode', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    if (options && options.length > 0) {
      return res.json(successResponse('Work modes retrieved', options));
    }

    return res.json(successResponse('Work modes retrieved', options || []));
  } catch (error) { next(error); }
};

export const getHiringGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let options: Array<{ id: string; label: string; value: string }> = [];
    try {
      options = await prisma.masterOption.findMany({
        where: { type: 'hiring_goal', status: 'active' },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        select: { id: true, label: true, value: true },
      });
    } catch {
      options = await prisma.$queryRaw<Array<{ id: string; label: string; value: string }>>`
        SELECT id, label, value
        FROM master_options
        WHERE type = 'hiring_goal' AND status = 'active'
        ORDER BY sort_order ASC, label ASC
      `;
    }

    const seen = new Set<string>();
    const data = options.reduce<Array<{ id: string; name: string }>>((result, option) => {
      const name = String(option.label || option.value || '').trim();
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        result.push({ id: option.id, name });
      }
      return result;
    }, []);

    return res.json(successResponse('Hiring goals retrieved', data));
  } catch (error) { next(error); }
};

export const getInvestorStages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbStages = await prisma.startupStage.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' }
    }).catch(() => []);

    if (dbStages.length > 0) {
      const stages = dbStages.map((s) => ({ id: s.id, label: s.name, value: s.name }));
      return res.json(successResponse('Investor stages retrieved', stages));
    }

    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'investor_stage', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    return res.json(successResponse('Investor stages retrieved', options || []));
  } catch (error) { next(error); }
};

export const getPlatformGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'platform_goal', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    return res.json(successResponse('Platform goals retrieved', options || []));
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

export const getBudgetRanges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbRanges = await (prisma as any).masterOption?.findMany({
      where: { type: { in: ['budget_range', 'project_budget_range', 'hiring_budget_range'] }, status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true, min: true, max: true, sortOrder: true }
    }).catch(() => []);

    const ranges = deduplicateMasterOptions(dbRanges || []).map((item: any) => ({
      id: item.id,
      label: item.label,
      value: item.value,
      min: item.min,
      max: item.max,
      sortOrder: item.sortOrder ?? 0,
      projectHireBudgetId: item.id,
      projectHireBudgetLabel: item.label,
    }));

    return res.json(successResponse('Budget ranges retrieved', ranges));
  } catch (error) { next(error); }
};

export const getDesignations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbDesignations = await (prisma as any).masterOption?.findMany({
      where: { type: { in: ['designation', 'startup_role', 'role'] }, status: 'active' },
      orderBy: { label: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    if (dbDesignations && dbDesignations.length > 0) {
      return res.json(successResponse('Designations retrieved', deduplicateMasterOptions(dbDesignations)));
    }

    return res.json(successResponse('Designations retrieved', []));
  } catch (error) { next(error); }
};

export const getFounderGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbGoals = await (prisma as any).masterOption?.findMany({
      where: { type: { in: ['founder_goal', 'startup_goal', 'platform_goal'] }, status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    if (dbGoals && dbGoals.length > 0) {
      return res.json(successResponse('Founder goals retrieved', deduplicateMasterOptions(dbGoals)));
    }

    return res.json(successResponse('Founder goals retrieved', []));
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

export const getFounderRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await (prisma as any).masterOption?.findMany({
      where: { type: { in: ['founder_role'] }, status: 'active' },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    const data = deduplicateMasterOptions(roles || []);
    return res.json({ success: true, data, rows: data });
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
      return res.json(successResponse('Team sizes retrieved', deduplicateMasterOptions(sizes)));
    }

    return res.json(successResponse('Team sizes retrieved', []));
  } catch (error) { next(error); }
};

const COUNTRY_INFO_MAP: Record<string, { code: string; phoneCode: string; flag: string; currencyCode: string }> = {
  "india": { code: "IN", phoneCode: "+91", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â³", currencyCode: "INR" },
  "usa": { code: "US", phoneCode: "+1", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¸", currencyCode: "USD" },
  "us": { code: "US", phoneCode: "+1", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¸", currencyCode: "USD" },
  "united states": { code: "US", phoneCode: "+1", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¸", currencyCode: "USD" },
  "uk": { code: "GB", phoneCode: "+44", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â§", currencyCode: "GBP" },
  "united kingdom": { code: "GB", phoneCode: "+44", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â§", currencyCode: "GBP" },
  "uae": { code: "AE", phoneCode: "+971", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Âª", currencyCode: "AED" },
  "united arab emirates": { code: "AE", phoneCode: "+971", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Âª", currencyCode: "AED" },
  "australia": { code: "AU", phoneCode: "+61", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Âº", currencyCode: "AUD" },
  "canada": { code: "CA", phoneCode: "+1", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¨ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¦", currencyCode: "CAD" },
  "germany": { code: "DE", phoneCode: "+49", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â©ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Âª", currencyCode: "EUR" },
  "france": { code: "FR", phoneCode: "+33", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â«ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â·", currencyCode: "EUR" },
  "singapore": { code: "SG", phoneCode: "+65", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¬", currencyCode: "SGD" },
  "japan": { code: "JP", phoneCode: "+81", flag: "ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Âµ", currencyCode: "JPY" },
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
        const flag = row.flag || info?.flag || cscInfo?.flag || 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â®ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¡Ãƒâ€šÃ‚Â³';
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

    return res.json(successResponse('Countries retrieved', []));
  } catch (error) { next(error); }
};

export const getStates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawParam = String(req.query.countryCode || req.query.countryId || req.query.country || 'IN').trim();
    const lowerParam = rawParam.toLowerCase();

    const NAME_TO_CODE_MAP: Record<string, string> = {
      "india": "IN",
      "united states": "US",
      "usa": "US",
      "united states of america": "US",
      "united kingdom": "GB",
      "uk": "GB",
      "canada": "CA",
      "australia": "AU",
      "united arab emirates": "AE",
      "uae": "AE",
      "germany": "DE",
      "france": "FR",
      "singapore": "SG"
    };

    let isoCode = NAME_TO_CODE_MAP[lowerParam] || (rawParam.length === 2 ? rawParam.toUpperCase() : "");

    if (!isoCode && rawParam.length > 2) {
      const dbRow = await prisma.country.findFirst({
        where: {
          OR: [
            { id: rawParam },
            { name: { equals: rawParam } },
            { code: { equals: rawParam } }
          ]
        }
      }).catch(() => null);

      if (dbRow?.code) {
        isoCode = dbRow.code.toUpperCase();
      } else if (dbRow?.name) {
        const info = COUNTRY_INFO_MAP[dbRow.name.trim().toLowerCase()];
        if (info?.code) isoCode = info.code;
      }
    }

    if (!isoCode) {
      isoCode = "IN";
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
  } catch (error) {
    return res.json(successResponse('States retrieved', []));
  }
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

    let rows: any[] = freelancers;
    const userId = (req as any).user?.id;
    let savedIds = new Set<string>();
    if (userId) {
      const { getJsonSetting } = await import('../../../common/helpers/portal-shared.js');
      const savedRows = await getJsonSetting(userId, 'savedFreelancers', [] as any[]);
      const ids = savedRows.map((r: any) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean);
      savedIds = new Set(ids);
    }

    const allSkillIds = new Set<string>();
    const allExpStrs = new Set<string>();
    rows.forEach(r => {
      if (r.freelancerProfile?.skills) {
        String(r.freelancerProfile.skills).split(',').map(s => s.trim()).filter(s => /^[0-9a-f-]{36}$/i.test(s)).forEach(id => allSkillIds.add(id));
      }
      if (r.freelancerProfile?.experience) {
        allExpStrs.add(String(r.freelancerProfile.experience).trim());
      }
    });

    const [dbSkills, dbExps, masterExps] = await Promise.all([
      allSkillIds.size ? prisma.skill.findMany({ where: { id: { in: Array.from(allSkillIds) } }, select: { id: true, name: true } }).catch(() => []) : [],
      allExpStrs.size ? prisma.experienceLevel.findMany({ where: { OR: [{ id: { in: Array.from(allExpStrs) } }, { name: { in: Array.from(allExpStrs) } }] }, select: { id: true, name: true } }).catch(() => []) : [],
      allExpStrs.size ? (prisma as any).masterOption?.findMany({ where: { type: 'experience_level', status: 'active', OR: [{ id: { in: Array.from(allExpStrs) } }, { value: { in: Array.from(allExpStrs) } }, { label: { in: Array.from(allExpStrs) } }] }, select: { id: true, label: true, value: true } }).catch(() => []) : []
    ]);

    const skillMap = new Map<string, string>((dbSkills as any[]).map(s => [s.id, s.name]));

    rows = rows.map((r: any) => {
      let mappedSkills = r.freelancerProfile?.skills || "";
      if (r.freelancerProfile?.skills) {
        mappedSkills = String(r.freelancerProfile.skills).split(',').map(s => {
          const trimmed = s.trim();
          return skillMap.get(trimmed) || (/^[0-9a-f-]{36}$/i.test(trimmed) ? '' : trimmed);
        }).filter(Boolean).join(', ');
      }

      let mappedExp = r.freelancerProfile?.experience || "";
      if (mappedExp) {
        const me = (masterExps as any[]).find(e => e.id === mappedExp || e.value === mappedExp || e.label === mappedExp);
        if (me) mappedExp = me.label || me.value;
        else {
          const de = (dbExps as any[]).find(e => e.id === mappedExp || e.name === mappedExp);
          if (de) mappedExp = de.name;
        }
      }

      return {
        ...r,
        freelancerProfile: r.freelancerProfile ? {
          ...r.freelancerProfile,
          skills: mappedSkills,
          experience: mappedExp
        } : null,
        isSaved: savedIds.has(r.id)
      };
    });

    return res.json(successResponse('Freelancers retrieved', rows, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'client', status: 'active', deletedAt: null },
        include: { clientProfile: true },
        skip, take: limit
      }),
      prisma.user.count({ where: { role: 'client', status: 'active', deletedAt: null } })
    ]);

    const allIndIds = new Set<string>();
    const allHgIds = new Set<string>();

    clients.forEach((c) => {
      if (c.clientProfile?.industry) {
        String(c.clientProfile.industry).split(',').map(s => s.trim()).filter(Boolean).forEach(id => allIndIds.add(id));
      }
      if (c.clientProfile?.hiringGoal) {
        String(c.clientProfile.hiringGoal).split(',').map(s => s.trim()).filter(Boolean).forEach(id => allHgIds.add(id));
      }
    });

    const [dbInds, dbHgs] = await Promise.all([
      allIndIds.size ? prisma.industry.findMany({ where: { id: { in: Array.from(allIndIds) } }, select: { id: true, name: true } }).catch(() => []) : [],
      allHgIds.size ? (prisma as any).masterOption?.findMany({ where: { id: { in: Array.from(allHgIds) } }, select: { id: true, label: true } }).catch(() => []) : []
    ]);

    const indMap = new Map<string, string>((dbInds as any[]).map(r => [r.id, r.name]));
    const hgMap = new Map<string, string>((dbHgs as any[]).map(r => [r.id, r.label]));

    const formattedClients = clients.map((c: any) => {
      let formattedInds: any[] = [];
      let formattedHgs: any[] = [];

      if (c.clientProfile?.industry) {
        formattedInds = String(c.clientProfile.industry).split(',').map(s => s.trim()).filter(Boolean).map(id => ({
          industryId: id,
          industryName: indMap.get(id) || id
        }));
      }

      if (c.clientProfile?.hiringGoal) {
        formattedHgs = String(c.clientProfile.hiringGoal).split(',').map(s => s.trim()).filter(Boolean).map(id => ({
          hiringGoalId: id,
          hiringGoalName: hgMap.get(id) || id
        }));
      }

      return {
        ...c,
        clientProfile: c.clientProfile ? {
          ...c.clientProfile,
          Industry: formattedInds,
          HiringGoal: formattedHgs
        } : null
      };
    });

    return res.json(successResponse('Clients retrieved', formattedClients, { page, limit, total, totalPages: Math.ceil(total / limit) }));
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

    const focusAreaIds = [...new Set(investors.flatMap((investor) =>
      String(investor.investorProfile?.focusAreas || '').split(',').map((value) => value.trim()).filter(Boolean)
    ))];
    const [focusOptions, focusIndustries] = await Promise.all([
      (prisma as any).masterOption.findMany({
        where: { id: { in: focusAreaIds } },
        select: { id: true, label: true },
      }).catch(() => []),
      prisma.industry.findMany({
        where: { id: { in: focusAreaIds } },
        select: { id: true, name: true },
      }).catch(() => []),
    ]);
    const focusAreaNameMap = new Map<string, string>([
      ...focusOptions.map((item: any): [string, string] => [item.id, item.label || '']),
      ...focusIndustries.map((item): [string, string] => [item.id, item.name]),
    ]);
    const formattedInvestors = investors.map((investor) => ({
      ...investor,
      investorProfile: investor.investorProfile ? {
        ticketMin: investor.investorProfile.ticketMin,
        ticketMax: investor.investorProfile.ticketMax,
        deals: investor.investorProfile.deals,
        FocusAreas: String(investor.investorProfile.focusAreas || '')
          .split(',')
          .map((focusAreaId) => focusAreaId.trim())
          .filter(Boolean)
          .map((focusAreaId) => ({
            focusAreaId,
            focusAreaName: focusAreaNameMap.get(focusAreaId) || '',
          })),
      } : null,
    }));

    return res.json(successResponse('Investors retrieved', formattedInvestors, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
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

// FORMAT HELPER
const formatStartupResponse = (
  idea: any,
  user: any,
  founderProfile: any,
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

    industry: industryValue,
    category: categoryValue,
    stage: stageValue,

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
    isSaved: false, // Public has no user attached
    hasInvested: false
  };

  if (!isDetailed) {
    return baseResult;
  }

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

const loadRelatedDataForIdeas = async (ideas: any[]) => {
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

export const getStartups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [ideas, total] = await Promise.all([
      prisma.startupIdea.findMany({
        where: { status: 'active', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip, take: limit
      }),
      prisma.startupIdea.count({ where: { status: 'active', deletedAt: null } })
    ]);

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(ideas);

    const data = ideas.map(idea => {
      // isDetailed = false
      return formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), industryMap, optionMap, false, platformRaisedMap);
    }).filter(Boolean);

    return res.json(successResponse('Startups retrieved', data, { page, limit, total, totalPages: Math.ceil(total / limit) }));
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

export const getPricingPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const industryId = req.query.industryId as string | undefined;
    const role = req.query.role as string | undefined;
    const whereCondition: any = { status: "active" };

    if (role) {
      whereCondition.role = role;
    }

    let includeFree = false;
    if (industryId) {
      const industry = await prisma.industry.findUnique({
        where: { id: industryId },
      });
      if (industry && (industry as any).isFreePlanEnabled) {
        includeFree = true;
      }
    }

    if (!includeFree) {
      whereCondition.amount = { gt: 0 };
      whereCondition.duration = { not: "90_days" };
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where: whereCondition,
      orderBy: { amount: "asc" },
    });

    // Some endpoints expect `rows` and `total` for list responses.
    return res.json({
      success: true,
      message: 'Pricing plans retrieved',
      data: plans || [],
      rows: plans || [],
      total: plans?.length || 0
    });
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


    if (modelName === 'startup') {
      const id = req.params.id;

      const idea = await prisma.startupIdea.findUnique({ where: { id } }).catch(() => null);
      if (!idea || idea.deletedAt) {
        return res.status(404).json({ success: false, message: 'Startup not found' });
      }

      const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas([idea]);

      let isSaved = false;
      let hasInvested = false;
      const viewingUserId = (req as any).user?.id;
      if (viewingUserId) {
        const row = await prisma.setting.findUnique({ where: { key: `investor_watchlist:${viewingUserId}` } });
        if (row?.value) {
          try {
            const list = JSON.parse(row.value);
            if (Array.isArray(list) && list.some((i: any) => i.startupId === id)) isSaved = true;
          } catch { }
        }
        const inv = await prisma.investment.findFirst({
          where: { investor: viewingUserId, startup: id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } }
        });
        if (inv) hasInvested = true;
      }

      const data = formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), industryMap, optionMap, true, platformRaisedMap);
      return res.json(successResponse('Details retrieved for startup', { ...data, isSaved, hasInvested }));
    }

    if (modelName === 'founder') {
      const id = req.params.id;

      const user = await prisma.user.findFirst({
        where: { id }
      }).catch(() => null);

      if (!user) {
        return res.status(404).json({ success: false, message: 'Founder profile not found' });
      }

      const reg = parseRegData(user.registrationData);
      const profile = await prisma.founderProfile.findUnique({ where: { userId: id } }).catch(() => null);
      // ── Resolve countryId UUID → country name (founder) ──
      const rawC = reg.countryId || user.country || reg.country || '';
      let founderCountryName = rawC;
      let cntryId = rawC;
      if (rawC && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(rawC)) {
        try {
          const cRow = await prisma.country.findFirst({ where: { id: rawC }, select: { id: true, name: true } });
          if (cRow) { founderCountryName = cRow.name; cntryId = cRow.id; }
        } catch { /* keep raw */ }
      } else {
        cntryId = rawC ? (rawC.length === 2 ? rawC.toUpperCase() : rawC) : '';
        founderCountryName = cntryId;
      }

      const pgArr: string[] = profile?.primaryGoal
        ? String(profile.primaryGoal).split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(reg.primaryGoal) ? reg.primaryGoal : []);
      const indArr: string[] = profile?.industry
        ? String(profile.industry).split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(reg.industry) ? reg.industry : []);

      // ── Resolve primaryGoal IDs → names via master_options ──
      const pgNames: string[] = new Array(pgArr.length).fill('');
      if (pgArr.length > 0) {
        try {
          const pgRows = await (prisma as any).masterOption.findMany({
            where: { id: { in: pgArr } }, select: { id: true, label: true }
          });
          const pgMap = new Map(pgRows.map((r: any) => [r.id, r.label]));
          pgArr.forEach((pid: string, i: number) => { pgNames[i] = (pgMap.get(pid) as string) || ''; });
        } catch { /* names remain empty */ }
      }

      // ── Resolve industry IDs → names via industry table ──
      const indNames: string[] = new Array(indArr.length).fill('');
      if (indArr.length > 0) {
        try {
          const dbInd = await prisma.industry.findMany({ where: { id: { in: indArr } }, select: { id: true, name: true } });
          const indMap = new Map(dbInd.map((r: any) => [r.id, r.name]));
          indArr.forEach((iid: string, i: number) => { indNames[i] = (indMap.get(iid) as string) || ''; });
        } catch { /* names remain empty */ }
      }

      const numericTeamSize = profile?.teamSize ?? (reg.teamSize ? parseInt(String(reg.teamSize), 10) || 1 : 1);
      const teamSizeOption = await (prisma as any).masterOption?.findFirst({
        where: { type: 'team_size', status: 'active', min: { lte: numericTeamSize }, max: { gte: numericTeamSize } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, value: true },
      }).catch(() => null);

      const founderDetails = {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || '',
        name: user.fullName || reg.fullName || '',
        email: user.email || reg.email || '',
        avatarUrl: user.avatarUrl || reg.avatarUrl || null,
        avatar: user.avatarUrl || reg.avatarUrl || null,
        bio: user.bio || reg.bio || reg.pitch || '',
        phone: user.phone || reg.phone || reg.mobile || '',
        city: user.city || reg.city || '',
        country: founderCountryName,
        countryId: cntryId,
        state: user.state || reg.state || '',
        stateId: reg.stateId || user.state || '',
        startupName: profile?.startupName || reg.startupName || '',
        pitch: profile?.pitch || reg.pitch || '',
        founderRole: profile?.founderRole || reg.founderRole || 'Founder',
        founderBio: profile?.founderBio || reg.founderBio || '',
        stage: profile?.stage || reg.stage || 'Seed',
        raised: profile?.raised ?? reg.raised ?? 0,
        targetRaise: profile?.targetRaise ?? reg.targetRaise ?? 500000,
        teamSize: teamSizeOption ? { id: teamSizeOption.id, name: teamSizeOption.label || teamSizeOption.value } : null,
        PrimaryGoal: oneOrMany(pgArr.map((pid: string, i: number) => ({
          primaryGoalId: pid,
          primaryGoalName: pgNames[i] || '',
        }))),
        Industry: oneOrMany(indArr.map((iid: string, i: number) => ({
          industryId: iid,
          industryName: indNames[i] || '',
        }))),
        role: user.role || 'founder',
        status: user.status || 'active',
        verified: Boolean(user.isVerified || (user as any).verified),
        registrationData: reg,
        savedData: true,
        isSaved: true,
      };

      const idea = await prisma.startupIdea.findFirst({
        where: { founder: id, deletedAt: null },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null);

      let startupDetails: any = null;
      let isSaved = false;
      let hasInvested = false;
      const viewingUserId = (req as any).user?.id;

      if (viewingUserId) {
        const row = await prisma.setting.findUnique({ where: { key: `investor_watchlist_founders:${viewingUserId}` } });
        if (row?.value) {
          try {
            const list = JSON.parse(row.value);
            if (Array.isArray(list) && list.some((i: any) => i.startupId === id)) isSaved = true;
          } catch { }
        }
      }

      if (idea) {
        const { industryMap, optionMap } = await loadRelatedDataForIdeas([idea]);
        startupDetails = formatStartupResponse(idea, user, profile, industryMap, optionMap, true);
        if (startupDetails) {
          delete startupDetails.user; // Remove redundant nested user
        }
        if (viewingUserId) {
          const inv = await prisma.investment.findFirst({
            where: { investor: viewingUserId, startup: idea.id, status: { in: ['Active', 'Completed', 'Closed', 'Pending', 'Offer'] } }
          });
          if (inv) hasInvested = true;
        }
      }

      const result = {
        ...founderDetails,
        isSaved,
        hasInvested,
        startup: startupDetails
      };

      return res.json(successResponse('Details retrieved for founder', result));
    }

    if (modelName === 'freelancer') {
      const id = req.params.id;
      const user = await prisma.user.findFirst({
        where: { id },
        include: { freelancerProfile: true }
      }).catch(() => null);

      if (!user) {
        return res.status(404).json({ success: false, message: 'Freelancer not found' });
      }

      const reg = parseRegData(user.registrationData);
      const indArr = Array.isArray(reg.industry) ? reg.industry : (user.freelancerProfile?.industry ? String(user.freelancerProfile.industry).split(",").map(s => s.trim()) : (reg.industryIds || (reg.industry ? [String(reg.industry)] : [])));
      const sklArr = Array.isArray(reg.skills) ? reg.skills : (user.freelancerProfile?.skills ? String(user.freelancerProfile.skills).split(",").map(s => s.trim()) : (reg.skillsIds || reg.skillIds || (reg.skills ? [String(reg.skills)] : [])));
      const wmArr = Array.isArray(reg.workMode) ? reg.workMode : (user.freelancerProfile?.workMode ? String(user.freelancerProfile.workMode).split(",").map(s => s.trim()) : (reg.workModeIds || (reg.workMode ? [String(reg.workMode)] : [])));
      const stId = reg.stateId || user.state || reg.state || "";
      const rawC = reg.countryId || user.country || reg.country || "";
      const cntryId = rawC ? (rawC.length === 2 ? rawC.toUpperCase() : (rawC.toLowerCase() === "india" ? "IN" : (rawC.toLowerCase() === "united states" || rawC.toLowerCase() === "usa" ? "US" : rawC))) : "IN";

      const dbSkills = await prisma.skill.findMany({ where: { id: { in: sklArr } } }).catch(() => []);
      const skillMap = new Map<string, string>(dbSkills.map((row): [string, string] => [row.id, row.name]));
      const sklNames = sklArr.map((id: string) => skillMap.get(id) || (/^[0-9a-f-]{36}$/i.test(id) ? '' : id));

      const dbIndustries = await prisma.industry.findMany({ where: { id: { in: indArr } } }).catch(() => []);
      const industryMap = new Map<string, string>(dbIndustries.map((row): [string, string] => [row.id, row.name]));
      const indNames = indArr.map((id: string) => industryMap.get(id) || (/^[0-9a-f-]{36}$/i.test(id) ? '' : id));

      const dbWorkModes = await prisma.workMode.findMany({ where: { id: { in: wmArr } } }).catch(() => []);
      const workModeMap = new Map<string, string>(dbWorkModes.map((row): [string, string] => [row.id, row.name]));
      const wmNames = wmArr.map((id: string) => workModeMap.get(id) || (/^[0-9a-f-]{36}$/i.test(id) ? '' : id));

      const rawExp = user.freelancerProfile?.experience || reg.experienceLevel || reg.experience || "";
      let expOption = null;
      if (rawExp) {
        expOption = await (prisma as any).masterOption?.findFirst({
          where: { type: 'experience_level', status: 'active', OR: [{ id: rawExp }, { value: rawExp }, { label: rawExp }] },
          select: { id: true, label: true, value: true }
        }).catch(() => null);

        if (!expOption) {
          const dbExp = await prisma.experienceLevel.findFirst({
            where: { status: 'active', OR: [{ id: rawExp }, { name: rawExp }] },
            select: { id: true, name: true }
          }).catch(() => null);
          if (dbExp) {
            expOption = { id: dbExp.id, label: dbExp.name, value: dbExp.name };
          }
        }
      }

      let isSaved = false;
      const viewingUserId = (req as any).user?.id;
      if (viewingUserId) {
        try {
          const row = await prisma.setting.findUnique({ where: { key: `savedFreelancers:${viewingUserId}` } });
          if (row?.value) {
            const list = JSON.parse(row.value);
            if (Array.isArray(list) && list.some((i: any) => i.freelancerId === id || i.id === id || i === id)) {
              isSaved = true;
            }
          }
        } catch { }
      }

      return res.json(successResponse('Details retrieved for freelancer', {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || "",
        name: user.fullName || reg.fullName || "",
        email: user.email,
        phone: user.phone || reg.phone || reg.mobile || "",
        avatarUrl: user.avatarUrl || reg.avatarUrl || null,
        avatar: user.avatarUrl || reg.avatarUrl || null,
        title: user.freelancerProfile?.titleHeadline || reg.titleHeadline || reg.title || "Freelancer",
        titleHeadline: user.freelancerProfile?.titleHeadline || reg.titleHeadline || reg.title || "Freelancer",
        professionalTitle: user.freelancerProfile?.titleHeadline || reg.titleHeadline || reg.title || "Freelancer",
        bio: user.bio || reg.bio || reg.overview || "",
        overview: user.bio || reg.bio || reg.overview || "",
        city: user.city || reg.city || "",
        country: user.country || reg.country || "",
        countryId: cntryId,
        state: user.state || reg.state || "",
        stateId: stId,

        Skills: sklArr.map((id: string, idx: number) => ({
          id: id,
          name: sklNames[idx] || id,
          skillId: id,
          skillName: sklNames[idx] || ''
        })),

        Industry: oneOrMany(indArr.map((id: string, idx: number) => ({
          id: id,
          name: indNames[idx] || id,
          industryId: id,
          industryName: indNames[idx] || ''
        }))),

        WorkMode: oneOrMany(wmArr.map((id: string, idx: number) => ({
          id: id,
          name: wmNames[idx] || id,
          workModeId: id,
          workModeName: wmNames[idx] || ''
        }))),
        hourlyRate: user.freelancerProfile?.hourlyRate ?? reg.hourlyRate ?? null,
        experience: rawExp,
        experienceLevel: rawExp,
        ExperienceLevel: rawExp ? {
          id: expOption?.id || rawExp,
          name: expOption?.label || expOption?.value || rawExp,
          experienceLevelId: expOption?.id || rawExp,
          experienceLevelName: expOption?.label || expOption?.value || rawExp
        } : null,
        yearsOfExperience: user.freelancerProfile?.yearsOfExperience || reg.yearsOfExperience || reg.yearsExperience || reg.years || null,
        portfolioUrl: user.freelancerProfile?.portfolioUrl || reg.portfolioUrl || reg.portfolio || reg.websiteUrl || null,
        linkedInUrl: user.freelancerProfile?.linkedInUrl || reg.linkedInUrl || reg.linkedin || null,
        githubUrl: user.freelancerProfile?.githubUrl || reg.githubUrl || reg.github || null,
        rating: user.freelancerProfile?.rating ?? 5.0,
        status: user.status || "active",
        verified: Boolean(user.isVerified || user.verified),
        role: user.role || 'freelancer',
        registrationData: reg,
        isSaved: isSaved
      }));
    }

    if (modelName === 'client') {
      const id = req.params.id;
      const user = await prisma.user.findFirst({
        where: { id },
        include: { clientProfile: true }
      }).catch(() => null);

      if (!user) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }

      const reg = parseRegData(user.registrationData);
      const compVal = user.clientProfile?.company || reg.companyName || reg.company || "";
      const csVal = user.clientProfile?.companySize || reg.companySize || reg.companySizeId || "1-10 Employees";
      const csId = reg.companySizeId || user.clientProfile?.companySize || reg.companySize || "1-10";
      const teamVal = user.clientProfile?.currentTeam || reg.currentTeam || reg.teamSize || reg.companySize || "1-10";
      const teamId = reg.currentTeamId || reg.currentTeamSizeId || user.clientProfile?.currentTeam || reg.currentTeam || reg.teamSize || "1-10";
      const rawB = user.clientProfile?.projectHireBudget || reg.projectHireBudgetId || reg.projectHireBudget || reg.budget || "";
      const budgetRaw = rawB == null ? "" : String(rawB).trim();
      const budgetOption = budgetRaw
        ? await (prisma as any).masterOption?.findFirst({
          where: {
            type: { in: ['budget_range', 'project_budget_range', 'hiring_budget_range'] },
            status: 'active',
            OR: [{ id: budgetRaw }, { value: budgetRaw }, { label: budgetRaw }]
          },
          select: { id: true, label: true, value: true }
        }).catch(() => null)
        : null;
      const budgetId = reg.projectHireBudgetId || budgetOption?.id || budgetRaw || null;
      const budgetLabel = budgetOption?.label || reg.projectHireBudget || budgetRaw || null;
      // ── Resolve countryId UUID → country name (client) ──
      const clientRawC = reg.countryId || user.country || reg.country || '';
      let countryName = clientRawC;
      let cntryId = clientRawC;
      if (clientRawC && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(clientRawC)) {
        try {
          const cRow = await prisma.country.findFirst({ where: { id: clientRawC }, select: { id: true, name: true } });
          if (cRow) { countryName = cRow.name; cntryId = cRow.id; }
        } catch { /* keep raw */ }
      } else {
        cntryId = clientRawC ? (clientRawC.length === 2 ? clientRawC.toUpperCase() : clientRawC) : '';
        countryName = cntryId;
      }
      const hgArr: string[] = user.clientProfile?.hiringGoal
        ? String(user.clientProfile.hiringGoal).split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(reg.hiringGoal) ? reg.hiringGoal : []);

      // ── Resolve hiringGoal IDs → names via master_options ──
      const hgNames: string[] = new Array(hgArr.length).fill('');
      if (hgArr.length > 0) {
        try {
          const hgRows = await (prisma as any).masterOption.findMany({
            where: { id: { in: hgArr } }, select: { id: true, label: true }
          });
          const hgMap = new Map(hgRows.map((r: any) => [r.id, r.label]));
          hgArr.forEach((hid: string, i: number) => { hgNames[i] = (hgMap.get(hid) as string) || ''; });
        } catch { /* names remain empty */ }
      }

      // ── Resolve client industry IDs → names via industry table ──
      const clientIndArr: string[] = user.clientProfile?.industry
        ? String(user.clientProfile.industry).split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(reg.industry) ? reg.industry : []);
      const clientIndNames: string[] = new Array(clientIndArr.length).fill('');
      if (clientIndArr.length > 0) {
        try {
          const ciRows = await prisma.industry.findMany({ where: { id: { in: clientIndArr } }, select: { id: true, name: true } });
          const ciMap = new Map(ciRows.map((r: any) => [r.id, r.name]));
          clientIndArr.forEach((iid: string, i: number) => { clientIndNames[i] = (ciMap.get(iid) as string) || ''; });
        } catch { /* names remain empty */ }
      }

      let isSaved = false;
      const viewingUserId = (req as any).user?.id;
      if (viewingUserId) {
        try {
          const row = await prisma.setting.findUnique({ where: { key: `savedClients:${viewingUserId}` } });
          if (row?.value) {
            const list = JSON.parse(row.value);
            if (Array.isArray(list) && list.some((i: any) => i.clientId === id || i.id === id || i === id)) {
              isSaved = true;
            }
          }
        } catch { }
      }

      return res.json(successResponse('Details retrieved for client', {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || '',
        name: user.fullName || reg.fullName || '',
        email: user.email,
        phone: user.phone || reg.phone || reg.mobile || '',
        avatarUrl: user.avatarUrl || reg.avatarUrl || null,
        avatar: user.avatarUrl || reg.avatarUrl || null,
        company: compVal,
        companyName: compVal,
        companySize: csVal,
        companySizeId: csId,
        currentTeam: teamVal,
        currentTeamId: teamId,
        currentTeamSize: teamVal,
        currentTeamSizeId: teamId,
        projectHireBudget: budgetId,
        projectHireBudgetId: budgetId,
        projectHireBudgetLabel: budgetLabel,
        Industry: oneOrMany(clientIndArr.map((industryId: string, index: number) => ({
          industryId,
          industryName: clientIndNames[index] || '',
        }))),
        HiringGoal: oneOrMany(hgArr.map((hid: string, i: number) => ({
          hiringGoalId: hid,
          hiringGoalName: hgNames[i] || '',
        }))),
        bio: user.bio || reg.bio || '',
        city: user.city || reg.city || '',
        country: countryName,
        countryId: cntryId,
        state: user.state || reg.state || '',
        stateId: reg.stateId || user.state || '',
        totalSpend: Number(user.clientProfile?.totalSpend ?? 0),
        projectsPosted: user.clientProfile?.projectsPosted ?? 0,
        status: user.status || 'active',
        verified: Boolean(user.isVerified || (user as any).verified),
        role: user.role || 'client',
        registrationData: reg,
        isSaved: isSaved,
      }));
    }

    if (modelName === 'investor') {
      const id = req.params.id;
      const user = await prisma.user.findFirst({
        where: { id },
        include: { investorProfile: true }
      }).catch(() => null);

      if (!user) {
        return res.status(404).json({ success: false, message: 'Investor not found' });
      }

      const reg = parseRegData(user.registrationData);

      // ── Resolve preferredStage IDs → names via master_options ──
      const psArr: string[] = user.investorProfile?.preferredStage
        ? String(user.investorProfile.preferredStage).split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(reg.preferredStage) ? reg.preferredStage : []);
      const psNames: string[] = new Array(psArr.length).fill('');
      if (psArr.length > 0) {
        try {
          const psRows = await (prisma as any).masterOption.findMany({
            where: { id: { in: psArr } },
            select: { id: true, label: true }
          });
          const psMap = new Map(psRows.map((r: any) => [r.id, r.label]));
          psArr.forEach((pid: string, i: number) => { psNames[i] = (psMap.get(pid) as string) || ''; });
        } catch {
          // Names remain empty when the catalog lookup fails.
        }
      }

      // ── Resolve focusAreas IDs → names via master_options then industry table ──
      const faArr: string[] = user.investorProfile?.focusAreas
        ? String(user.investorProfile.focusAreas).split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(reg.focusAreas) ? reg.focusAreas : []);
      const registrationFocusAreas: string[] = Array.isArray(reg.focusAreas) ? reg.focusAreas : [];
      const faNames: string[] = new Array(faArr.length).fill('');
      if (faArr.length > 0) {
        try {
          const faRows = await (prisma as any).masterOption.findMany({
            where: { id: { in: faArr } },
            select: { id: true, label: true }
          });
          const faMap = new Map(faRows.map((r: any) => [r.id, r.label]));
          const missingFaIds = faArr.filter((fid: string) => !faMap.has(fid));
          if (missingFaIds.length > 0) {
            const indRows = await prisma.industry.findMany({
              where: { id: { in: missingFaIds } },
              select: { id: true, name: true }
            });
            indRows.forEach((r: any) => faMap.set(r.id, r.name));
          }
          faArr.forEach((fid: string, i: number) => {
            faNames[i] = (faMap.get(fid) as string)
              || (/^[0-9a-f-]{36}$/i.test(String(registrationFocusAreas[i] || '')) ? '' : registrationFocusAreas[i])
              || '';
          });
        } catch {
          faArr.forEach((_fid: string, i: number) => {
            faNames[i] = /^[0-9a-f-]{36}$/i.test(String(registrationFocusAreas[i] || '')) ? '' : registrationFocusAreas[i] || '';
          });
        }
      }

      // ── Resolve investorType ID → label via master_options ──
      const invTypeRaw = user.investorProfile?.investorType || reg.investorType || '';
      let invTypeName = invTypeRaw;
      if (invTypeRaw) {
        try {
          const itRow = await (prisma as any).masterOption.findFirst({
            where: { id: invTypeRaw },
            select: { id: true, label: true }
          });
          if (itRow?.label) invTypeName = itRow.label;
        } catch { /* keep raw */ }
      }

      // ── Resolve countryId UUID → country name ──
      const rawC = reg.countryId || user.country || reg.country || '';
      const investorCountry = rawC ? await prisma.country.findFirst({
        where: { OR: [{ id: rawC }, { name: rawC }, { code: rawC }] },
        select: { id: true, name: true, code: true },
      }).catch(() => null) : null;
      const investorCountryName = investorCountry?.name || rawC;
      const investorCountryId = investorCountry?.id || rawC;
      const investorStateRaw = String(reg.stateId || user.state || reg.state || '').trim();
      let investorStateName = String(user.state || reg.state || investorStateRaw);
      let investorStateId = investorStateRaw;
      const investorCountryCode = investorCountry?.code || (rawC.length === 2 ? rawC.toUpperCase() : 'IN');
      const csc = await getCSC();
      if (investorStateRaw && csc?.State) {
        const state = csc.State.getStatesOfCountry(investorCountryCode).find((item: any) =>
          String(item.isoCode).toLowerCase() === investorStateRaw.toLowerCase()
          || String(item.name).toLowerCase() === investorStateRaw.toLowerCase()
        );
        if (state) {
          investorStateName = state.name;
          investorStateId = state.isoCode;
        }
      }
      const viewerId = (req as any).user?.id as string | undefined;
      let isSaved = false;
      if (viewerId) {
        const [founderWatchlist, genericFavorites] = await Promise.all([
          prisma.setting.findUnique({ where: { key: `founder_investor_watchlist:${viewerId}` }, select: { value: true } }).catch(() => null),
          prisma.setting.findUnique({ where: { key: `favorites:${viewerId}` }, select: { value: true } }).catch(() => null),
        ]);
        try {
          const items = JSON.parse(founderWatchlist?.value || '[]');
          isSaved = Array.isArray(items) && items.some((item: any) =>
            item.investorId === user.id || item.investorId === user.investorProfile?.id
          );
        } catch { /* ignore invalid legacy setting */ }
        if (!isSaved) {
          try {
            const items = JSON.parse(genericFavorites?.value || '[]');
            isSaved = Array.isArray(items) && items.some((item: any) =>
              item.entityType === 'investor'
              && (item.entityId === user.id || item.entityId === user.investorProfile?.id)
            );
          } catch { /* ignore invalid legacy setting */ }
        }
      }
      const savedData = Boolean(user.investorProfile || Object.keys(reg).length > 0);

      return res.json(successResponse('Details retrieved for investor', {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || '',
        name: user.fullName || reg.fullName || '',
        email: user.email,
        phone: user.phone || reg.phone || reg.mobile || '',
        avatarUrl: user.avatarUrl || reg.avatarUrl || null,
        avatar: user.avatarUrl || reg.avatarUrl || null,
        InvestorType: invTypeRaw ? {
          investorTypeId: invTypeRaw,
          investorTypeName: invTypeName,
        } : null,
        firm: user.investorProfile?.firm || reg.firm || reg.firmName || '',
        isAccredited: user.investorProfile?.isAccredited || reg.isAccredited || 'Yes',
        ticketMin: user.investorProfile?.ticketMin ?? reg.ticketMin ?? 25000,
        ticketMax: user.investorProfile?.ticketMax ?? reg.ticketMax ?? 250000,
        bio: user.bio || reg.bio || reg.thesis || '',
        thesis: (user.investorProfile as any)?.thesis || reg.thesis || '',
        PreferredStage: psArr.map((pid: string, i: number) => ({
          preferredStageId: pid,
          preferredStageName: psNames[i] || '',
        })),
        FocusAreas: faArr.map((fid: string, i: number) => ({
          focusAreaId: fid,
          focusAreaName: faNames[i] || '',
        })),
        city: user.city || reg.city || '',
        country: investorCountryName,
        countryId: investorCountryId,
        state: investorStateName,
        stateId: investorStateId,
        status: user.status || 'active',
        verified: Boolean(user.isVerified || (user as any).verified),
        role: user.role || 'investor',
        registrationData: reg,
        isSaved,
      }));
    }

    return res.json(successResponse(`Details retrieved for ${modelName}`, { id: req.params.id, status: 'active' }));
  } catch (error) { next(error); }
};





export const getEducationLevels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbLevels = await prisma.masterOption.findMany({
      where: { type: 'education_level' },
      orderBy: { sortOrder: 'asc' }
    }).catch(() => []);

    const levels = dbLevels.map((l) => ({ id: l.id, label: l.label, value: l.value }));
    return res.json(successResponse('Education levels retrieved', levels));
  } catch (error) { next(error); }
};
