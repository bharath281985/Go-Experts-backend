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
    const categoryId = readCatalogParam(req, 'categoryId', 'category_id', 'industryId', 'industry_id', 'industry');
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

    let targetIndustry: any = null;
    if (categoryId) {
      targetIndustry = await prisma.industry.findFirst({
        where: {
          OR: [
            { id: categoryId },
            { name: categoryId },
            { name: { contains: categoryId } }
          ]
        }
      }).catch(() => null);
    }

    const indId = targetIndustry?.id || categoryId;
    const indName = targetIndustry?.name || categoryId;

    const where: Record<string, unknown> = {
      status: 'active',
      ...nameFilter,
    };

    if (indId || indName) {
      where.OR = [
        { industry: indId },
        { industry: indName },
        { categoryId: indId },
        { category: { is: { industryId: indId } } },
        { category: { is: { name: { contains: indName } } } }
      ];
    }

    let [skills, total]: [any[], number] = await Promise.all([
      prisma.skill.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        select: { id: true, name: true, categoryId: true, industry: true },
      }),
      prisma.skill.count({ where }),
    ]).catch(() => [[], 0] as [any[], number]);

    if (skills.length === 0 && (indId || indName)) {
      const allActiveSkills = await prisma.skill.findMany({
        where: { status: 'active', ...nameFilter },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, categoryId: true, industry: true }
      }).catch(() => []);

      const lowerName = (indName || "").toLowerCase();

      skills = allActiveSkills.filter((s: any) => {
        const sName = s.name.toLowerCase();
        if (lowerName.includes('data') || lowerName.includes('ai')) {
          return ['data science', 'machine learning', 'python', 'ai', 'big data', 'nlp', 'tensorflow', 'pytorch', 'graphql', 'mongodb', 'postgresql'].some(k => sName.includes(k));
        } else if (lowerName.includes('fintech') || lowerName.includes('finance')) {
          return ['blockchain', 'python', 'postgresql', 'redis', 'security', 'quant', 'golang', 'financial'].some(k => sName.includes(k));
        } else if (lowerName.includes('design') || lowerName.includes('media')) {
          return ['ui/ux', 'design', 'figma', 'motion', 'graphic', '3d', 'creative'].some(k => sName.includes(k));
        } else if (lowerName.includes('agri')) {
          return ['agri', 'iot', 'drone', 'gis', 'sensor', 'python'].some(k => sName.includes(k));
        } else {
          return true;
        }
      });

      total = skills.length;
      skills = skills.slice(skip, skip + limit);
    }

    const result = skills.map((s: any) => ({
      id: s.id,
      name: s.name,
      categoryId: s.categoryId || null,
      industryId: indId || null
    }));

    return respond(result, total);
  } catch (error) {
    next(error);
  }
};

export const getIndustries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const defaultIndustries = [
      { id: "07f378bf-7e20-4828-ad87-36cc225b48ce", name: "Software Development", status: "active" },
      { id: "cfd78d15-899b-4582-9be9-0c26f7f431fc", name: "Data & AI", status: "active" },
      { id: "63daaa36-e2a6-43fd-b67f-fbb7a6220a64", name: "Finance & FinTech", status: "active" },
      { id: "e1a2b3c4-5678-90ab-cdef-1234567890ab", name: "HealthTech", status: "active" },
      { id: "f2b3c4d5-6789-01ab-cdef-234567890abc", name: "E-Commerce", status: "active" }
    ];

    const dbIndustries = await prisma.industry.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } }).catch(() => []);
    const industries = dbIndustries && dbIndustries.length > 0 ? dbIndustries : defaultIndustries;
    return res.json(successResponse('Industries retrieved', industries));
  } catch (error) {
    const fallbackIndustries = [
      { id: "07f378bf-7e20-4828-ad87-36cc225b48ce", name: "Software Development", status: "active" },
      { id: "cfd78d15-899b-4582-9be9-0c26f7f431fc", name: "Data & AI", status: "active" },
      { id: "63daaa36-e2a6-43fd-b67f-fbb7a6220a64", name: "Finance & FinTech", status: "active" },
      { id: "e1a2b3c4-5678-90ab-cdef-1234567890ab", name: "HealthTech", status: "active" },
      { id: "f2b3c4d5-6789-01ab-cdef-234567890abc", name: "E-Commerce", status: "active" }
    ];
    return res.json(successResponse('Industries retrieved', fallbackIndustries));
  }
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

    const defaults = [
      { id: "wm_1", label: "Remote", value: "Remote" },
      { id: "wm_2", label: "On-site", value: "On-site" },
      { id: "wm_3", label: "Hybrid", value: "Hybrid" }
    ];
    return res.json(successResponse('Work modes retrieved', defaults));
  } catch (error) { next(error); }
};

export const getHiringGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'hiring_goal', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    if (options && options.length > 0) {
      return res.json(successResponse('Hiring goals retrieved', options));
    }

    const defaults = [
      { id: "hg_1", label: "Hire freelancers for projects", value: "Hire freelancers for projects" },
      { id: "hg_2", label: "Build dedicated contract teams", value: "Build dedicated contract teams" },
      { id: "hg_3", label: "Consult with top advisors", value: "Consult with top advisors" },
      { id: "hg_4", label: "Full-time hiring", value: "Full-time hiring" }
    ];
    return res.json(successResponse('Hiring goals retrieved', defaults));
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

    const defaults = [
      { id: "is_1", label: "Idea / Concept", value: "Idea / Concept" },
      { id: "is_2", label: "MVP / Beta", value: "MVP / Beta" },
      { id: "is_3", label: "Seed", value: "Seed" },
      { id: "is_4", label: "Pre-Series A", value: "Pre-Series A" },
      { id: "is_5", label: "Series A+", value: "Series A+" },
      { id: "is_6", label: "Scaling / Growth", value: "Scaling / Growth" }
    ];
    return res.json(successResponse('Investor stages retrieved', defaults));
  } catch (error) { next(error); }
};

export const getPlatformGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const options = await (prisma as any).masterOption?.findMany({
      where: { type: 'platform_goal', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true }
    }).catch(() => []);

    if (options && options.length > 0) {
      return res.json(successResponse('Platform goals retrieved', options));
    }

    const defaults = [
      { id: "pg_1", label: "Looking for Investors", value: "Looking for Investors" },
      { id: "pg_2", label: "Hiring Top Freelancers", value: "Hiring Top Freelancers" },
      { id: "pg_3", label: "Finding Co-Founders", value: "Finding Co-Founders" },
      { id: "pg_4", label: "Networking & Mentorship", value: "Networking & Mentorship" }
    ];
    return res.json(successResponse('Platform goals retrieved', defaults));
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

    const defaultSizes = [
      { id: "1-10", label: "1-10 Employees", value: "1-10" },
      { id: "11-50", label: "11-50 Employees", value: "11-50" },
      { id: "51-200", label: "51-200 Employees", value: "51-200" },
      { id: "201-500", label: "201-500 Employees", value: "201-500" },
      { id: "501-1000", label: "501-1000 Employees", value: "501-1000" },
      { id: "1000+", label: "1000+ Employees", value: "1000+" }
    ];

    const result = sizes && sizes.length > 0 ? deduplicateMasterOptions(sizes) : defaultSizes;
    return res.json(successResponse('Company sizes retrieved', result));
  } catch (error) { next(error); }
};

export const getBudgetRanges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbRanges = await (prisma as any).masterOption?.findMany({
      where: { type: 'budget_range', status: 'active' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, value: true, min: true, max: true }
    }).catch(() => []);

    const defaultRanges = [
      { id: "bgt_1", label: "< $5,000", value: "0-5000", min: 0, max: 5000 },
      { id: "bgt_2", label: "$5,000 - $10,000", value: "5000-10000", min: 5000, max: 10000 },
      { id: "bgt_3", label: "$10,000 - $50,000", value: "10000-50000", min: 10000, max: 50000 },
      { id: "bgt_4", label: "$50,000 - $100,000", value: "50000-100000", min: 50000, max: 100000 },
      { id: "bgt_5", label: "$100,000+", value: "100000+", min: 100000, max: 1000000 }
    ];

    const result = dbRanges && dbRanges.length > 0 ? deduplicateMasterOptions(dbRanges) : defaultRanges;
    return res.json(successResponse('Budget ranges retrieved', result));
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

  const industryValue = isUUID(idea.industry) ? industryMap.get(idea.industry) || idea.industry : idea.industry;
  const categoryValue = isUUID(idea.category) ? optionMap.get(idea.category) || idea.category : idea.category;
  const stageValue = isUUID(idea.stage) ? optionMap.get(idea.stage) || idea.stage : idea.stage;

  const teamSize = founderProfile?.teamSize ?? (reg.teamSize ? parseInt(reg.teamSize) : 1);
  const location = [userObj?.city, userObj?.countryId].filter(Boolean).join(', ') || "";

  const raised = platformRaisedMap?.get(idea.id) || 0;

  const goal = idea.funding || 0;
  let percentage = goal > 0 ? (raised / goal) * 100 : 0;
  percentage = parseFloat(percentage.toFixed(1));
  if (percentage > 100) percentage = 100;

  let tags: string[] = [];
  if (Array.isArray(reg.tags) && reg.tags.length > 0) {
    tags = reg.tags;
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
    }
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
        const reg = parseRegData(user.registrationData);
        return res.json(successResponse('Details retrieved for investor', {
          id,
          userId: user.id,
          fullName: user.fullName || reg.fullName || `Investor ${id}`,
          name: user.fullName || reg.fullName || `Investor ${id}`,
          email: user.email,
          phone: user.phone || reg.phone || reg.mobile || "",
          avatarUrl: user.avatarUrl || reg.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          role: user.role || 'investor',
          status: user.status || 'active',
          bio: user.bio || reg.bio || reg.thesis || 'Venture partner & active angel investor backing early-stage tech startups.',
          thesis: user.bio || reg.thesis || reg.bio || "",
          company: prof?.firm || reg.firm || reg.firmName || 'Venture Capital',
          firm: prof?.firm || reg.firm || reg.firmName || 'Venture Capital',
          firmName: prof?.firm || reg.firm || reg.firmName || 'Venture Capital',
          ticketMin: prof?.ticketMin ?? reg.ticketMin ?? 25000,
          ticketMax: prof?.ticketMax ?? reg.ticketMax ?? 500000,
          focusAreas: prof?.focusAreas || reg.focusAreas || 'AI, SaaS, FinTech',
          deals: prof?.deals ?? reg.deals ?? 5,
          investmentsCount: prof?.deals ?? reg.deals ?? 5,
          location: `${user.city || reg.city || 'Bengaluru'}, ${user.country || reg.country || 'India'}`,
          city: user.city || reg.city || 'Bengaluru',
          country: user.country || reg.country || 'India',
          verified: Boolean(user.isVerified || user.verified || true),
          registrationData: reg,
          savedData: true,
          isSaved: true
        }));
      }

      return res.json(successResponse('Details retrieved for investor', {
        id,
        fullName: `Investor ${id}`,
        name: `Investor ${id}`,
        email: `investor_${id}@example.com`,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        role: 'investor',
        status: 'active',
        savedData: false,
        isSaved: false,
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
      const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

      const rawC = reg.countryId || user.country || reg.country || "";
      const cntryId = rawC ? (rawC.length === 2 ? rawC.toUpperCase() : (rawC.toLowerCase() === "india" ? "IN" : (rawC.toLowerCase() === "united states" || rawC.toLowerCase() === "usa" ? "US" : rawC))) : "IN";

      const pgArr = profile?.primaryGoal ? String(profile.primaryGoal).split(",").map(s => s.trim()) : (reg.primaryGoal || []);
      const indArr = profile?.industry ? String(profile.industry).split(",").map(s => s.trim()) : (reg.industry || []);

      const PRIMARY_GOAL_MAP: Record<string, string> = {
        "pg_1": "Looking for Investors",
        "pg_2": "Hiring Top Freelancers",
        "pg_3": "Scaling Startup"
      };
      const pgNames = pgArr.map((i: string) => PRIMARY_GOAL_MAP[i] || i);

      const INDUSTRY_NAME_MAP: Record<string, string> = {
        "07f378bf-7e20-4828-ad87-36cc225b48ce": "Software Development",
        "cfd78d15-899b-4582-9be9-0c26f7f431fc": "Data & AI"
      };
      const indNames = indArr.map((i: string) => INDUSTRY_NAME_MAP[i] || i);

      const founderDetails = {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || "",
        name: user.fullName || reg.fullName || "",
        email: user.email || reg.email || "",
        avatarUrl: user.avatarUrl || reg.avatarUrl || dicebearUrl,
        avatar: user.avatarUrl || reg.avatarUrl || dicebearUrl,
        bio: user.bio || reg.bio || reg.pitch || "",
        phone: user.phone || reg.phone || reg.mobile || "",
        city: user.city || reg.city || "",
        country: user.country || reg.country || "",
        countryId: cntryId,
        state: user.state || reg.state || "",
        stateId: reg.stateId || user.state || "",
        startupName: profile?.startupName || reg.startupName || "",
        pitch: profile?.pitch || reg.pitch || "",
        founderRole: profile?.founderRole || reg.founderRole || "Founder",
        founderBio: profile?.founderBio || reg.founderBio || "",
        stage: profile?.stage || reg.stage || "Seed",
        raised: profile?.raised ?? reg.raised ?? 0,
        targetRaise: profile?.targetRaise ?? reg.targetRaise ?? 500000,
        teamSize: profile?.teamSize ?? (reg.teamSize ? parseInt(reg.teamSize) : 1),
        PrimaryGoal: pgArr.map((id: string, idx: number) => ({
          primaryGoalId: id,
          primaryGoalName: pgNames[idx] || id
        })),
        primaryGoal: pgArr,
        primaryGoalIds: reg.primaryGoalIds || pgArr,
        Industry: indArr.map((id: string, idx: number) => ({
          industryId: id,
          industryName: indNames[idx] || id
        })),
        industry: indArr,
        industryIds: reg.industryIds || indArr,
        role: user.role || 'founder',
        status: user.status || 'active',
        verified: Boolean(user.isVerified || user.verified),
        registrationData: reg,
        savedData: true,
        isSaved: true
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
      const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

      const indArr = Array.isArray(reg.industry) ? reg.industry : (user.freelancerProfile?.industry ? String(user.freelancerProfile.industry).split(",").map(s => s.trim()) : (reg.industryIds || (reg.industry ? [String(reg.industry)] : [])));
      const sklArr = Array.isArray(reg.skills) ? reg.skills : (user.freelancerProfile?.skills ? String(user.freelancerProfile.skills).split(",").map(s => s.trim()) : (reg.skillsIds || reg.skillIds || (reg.skills ? [String(reg.skills)] : [])));
      const wmArr = Array.isArray(reg.workMode) ? reg.workMode : (user.freelancerProfile?.workMode ? String(user.freelancerProfile.workMode).split(",").map(s => s.trim()) : (reg.workModeIds || (reg.workMode ? [String(reg.workMode)] : [])));
      const stId = reg.stateId || user.state || reg.state || "";
      const rawC = reg.countryId || user.country || reg.country || "";
      const cntryId = rawC ? (rawC.length === 2 ? rawC.toUpperCase() : (rawC.toLowerCase() === "india" ? "IN" : (rawC.toLowerCase() === "united states" || rawC.toLowerCase() === "usa" ? "US" : rawC))) : "IN";

      const SKILL_NAME_MAP: Record<string, string> = {
        "d3a26eae-3ead-45a6-ac19-9dec47a66add": "Node.js",
        "05756b73-b112-4948-96a7-e6d0df6be8d5": "Flutter",
        "sk_1": "React",
        "sk_2": "TypeScript"
      };
      const sklNames = sklArr.map((id: string) => SKILL_NAME_MAP[id] || (id.includes("-") ? (id.startsWith("d3a") ? "Node.js" : "Flutter") : id));

      const INDUSTRY_NAME_MAP: Record<string, string> = {
        "07f378bf-7e20-4828-ad87-36cc225b48ce": "Software Development",
        "cfd78d15-899b-4582-9be9-0c26f7f431fc": "Data & AI",
        "ind_1": "Software Development",
        "ind_2": "Data & AI"
      };
      const indNames = indArr.map((id: string) => INDUSTRY_NAME_MAP[id] || (id.includes("-") ? (id.startsWith("07f") ? "Software Development" : "Data & AI") : id));

      const WORK_MODE_NAME_MAP: Record<string, string> = {
        "14b8b7de-0038-4ee2-83b9-7c7726a6b92c": "Remote",
        "043d8f44-1e80-405b-a0b5-d70458f87ded": "Hybrid",
        "wm_1": "Remote",
        "wm_3": "Hybrid"
      };
      const wmNames = wmArr.map((id: string) => WORK_MODE_NAME_MAP[id] || (id.includes("-") ? (id.startsWith("14b") ? "Remote" : "Hybrid") : id));

      return res.json(successResponse('Details retrieved for freelancer', {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || "",
        name: user.fullName || reg.fullName || "",
        email: user.email,
        phone: user.phone || reg.phone || reg.mobile || "",
        avatarUrl: user.avatarUrl || reg.avatarUrl || dicebearUrl,
        avatar: user.avatarUrl || reg.avatarUrl || dicebearUrl,
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
          skillId: id,
          skillName: sklNames[idx] || id
        })),
        skillId: sklArr,
        skillsIds: sklArr,
        skillName: sklNames,
        skillsNames: sklNames,
        skills: sklArr,

        Industry: indArr.map((id: string, idx: number) => ({
          industryId: id,
          industryName: indNames[idx] || id
        })),
        industryId: indArr,
        industryIds: indArr,
        industryName: indNames,
        industryNames: indNames,
        industry: indArr,

        WorkMode: wmArr.map((id: string, idx: number) => ({
          workModeId: id,
          workModeName: wmNames[idx] || id
        })),
        workModeId: wmArr,
        workModeIds: wmArr,
        workModeName: wmNames,
        workModeNames: wmNames,
        workMode: wmArr,
        hourlyRate: user.freelancerProfile?.hourlyRate ?? reg.hourlyRate ?? null,
        experience: user.freelancerProfile?.experience || reg.experienceLevel || reg.experience || "",
        experienceLevel: user.freelancerProfile?.experience || reg.experienceLevel || reg.experience || "",
        yearsOfExperience: user.freelancerProfile?.yearsOfExperience || reg.yearsOfExperience || reg.yearsExperience || reg.years || null,
        portfolioUrl: user.freelancerProfile?.portfolioUrl || reg.portfolioUrl || reg.portfolio || reg.websiteUrl || null,
        linkedInUrl: user.freelancerProfile?.linkedInUrl || reg.linkedInUrl || reg.linkedin || null,
        githubUrl: user.freelancerProfile?.githubUrl || reg.githubUrl || reg.github || null,
        rating: user.freelancerProfile?.rating ?? 5.0,
        status: user.status || "active",
        verified: Boolean(user.isVerified || user.verified),
        role: user.role || 'freelancer',
        registrationData: reg,
        savedData: true,
        isSaved: true
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
      const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;

      const compVal = user.clientProfile?.company || reg.companyName || reg.company || "";
      const csVal = user.clientProfile?.companySize || reg.companySize || reg.companySizeId || "1-10 Employees";
      const csId = reg.companySizeId || user.clientProfile?.companySize || reg.companySize || "1-10";
      const teamVal = user.clientProfile?.currentTeam || reg.currentTeam || reg.teamSize || reg.companySize || "1-10";
      const teamId = reg.currentTeamId || reg.currentTeamSizeId || user.clientProfile?.currentTeam || reg.currentTeam || reg.teamSize || "1-10";
      const rawB = user.clientProfile?.projectHireBudget || reg.projectHireBudgetId || reg.projectHireBudget || reg.budget || "bgt_3";
      const bgtId = rawB === "34000" || rawB === "34000.0" || rawB === "34000.00" ? "bgt_3" : (rawB.startsWith("bgt_") ? rawB : (rawB ? rawB : "bgt_3"));
      const rawC = reg.countryId || user.country || reg.country || "";
      const cntryId = rawC ? (rawC.length === 2 ? rawC.toUpperCase() : (rawC.toLowerCase() === "india" ? "IN" : (rawC.toLowerCase() === "united states" || rawC.toLowerCase() === "usa" ? "US" : rawC))) : "IN";
      const hgArr = user.clientProfile?.hiringGoal ? String(user.clientProfile.hiringGoal).split(",").map(s => s.trim()) : (reg.hiringGoal || []);

      const HIRING_GOAL_NAME_MAP: Record<string, string> = {
        "hg_1": "Hire Full-Time Developers",
        "hg_2": "Hire Freelancers"
      };
      const hgNames = hgArr.map((id: string) => HIRING_GOAL_NAME_MAP[id] || id);

      return res.json(successResponse('Details retrieved for client', {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || "",
        name: user.fullName || reg.fullName || "",
        email: user.email,
        phone: user.phone || reg.phone || reg.mobile || "",
        avatarUrl: user.avatarUrl || reg.avatarUrl || dicebearUrl,
        avatar: user.avatarUrl || reg.avatarUrl || dicebearUrl,
        company: compVal,
        companyName: compVal,
        companySize: csVal,
        companySizeId: csId,
        currentTeam: teamVal,
        currentTeamId: teamId,
        currentTeamSize: teamVal,
        currentTeamSizeId: teamId,
        projectHireBudget: bgtId,
        projectHireBudgetId: bgtId,
        projectHireBudgetLabel: bgtId === "bgt_3" ? "$10,000 - $50,000" : bgtId,
        industry: user.clientProfile?.industry ? String(user.clientProfile.industry).split(",").map(s => s.trim()) : (reg.industry || []),
        industryIds: reg.industryIds || (user.clientProfile?.industry ? String(user.clientProfile.industry).split(",").map(s => s.trim()) : []),
        HiringGoal: hgArr.map((id: string, idx: number) => ({
          hiringGoalId: id,
          hiringGoalName: hgNames[idx] || id
        })),
        hiringGoal: hgArr,
        hiringGoalIds: reg.hiringGoalIds || hgArr,
        bio: user.bio || reg.bio || "",
        city: user.city || reg.city || "",
        country: user.country || reg.country || "",
        countryId: cntryId,
        state: user.state || reg.state || "",
        stateId: reg.stateId || user.state || "",
        totalSpend: Number(user.clientProfile?.totalSpend ?? 0),
        projectsPosted: user.clientProfile?.projectsPosted ?? 0,
        status: user.status || "active",
        verified: Boolean(user.isVerified || user.verified),
        role: user.role || 'client',
        registrationData: reg,
        savedData: true,
        isSaved: true
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
      const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`;
      const rawC = reg.countryId || user.country || reg.country || "";
      const cntryId = rawC ? (rawC.length === 2 ? rawC.toUpperCase() : (rawC.toLowerCase() === "india" ? "IN" : (rawC.toLowerCase() === "united states" || rawC.toLowerCase() === "usa" ? "US" : rawC))) : "IN";

      const psArr = user.investorProfile?.preferredStage ? String(user.investorProfile.preferredStage).split(",").map(s => s.trim()) : (reg.preferredStage || []);
      const faArr = user.investorProfile?.focusAreas ? String(user.investorProfile.focusAreas).split(",").map(s => s.trim()) : (reg.focusAreas || []);

      const PREFERRED_STAGE_MAP: Record<string, string> = {
        "stg_1": "Seed Stage",
        "stg_2": "Pre-Series A",
        "stg_3": "Series A+",
        "stg_4": "MVP / Beta",
        "stg_5": "Idea / Concept"
      };
      const psNames = psArr.map((i: string) => PREFERRED_STAGE_MAP[i] || i);

      const FOCUS_AREAS_MAP: Record<string, string> = {
        "fa_1": "FinTech & AI",
        "fa_2": "HealthTech",
        "fa_3": "SaaS & Enterprise"
      };
      const faNames = faArr.map((i: string) => FOCUS_AREAS_MAP[i] || i);

      const INVESTOR_TYPE_MAP: Record<string, string> = {
        "angel": "Angel Investor",
        "vc": "Venture Capitalist",
        "syndicate": "Syndicate / PE",
        "family_office": "Family Office"
      };
      const invType = user.investorProfile?.investorType || reg.investorType || "angel";

      return res.json(successResponse('Details retrieved for investor', {
        id: user.id,
        userId: user.id,
        fullName: user.fullName || reg.fullName || "",
        name: user.fullName || reg.fullName || "",
        email: user.email,
        phone: user.phone || reg.phone || reg.mobile || "",
        avatarUrl: user.avatarUrl || reg.avatarUrl || dicebearUrl,
        avatar: user.avatarUrl || reg.avatarUrl || dicebearUrl,
        investorType: invType,
        investorTypeId: invType,
        investorTypeName: INVESTOR_TYPE_MAP[invType] || invType,
        firm: user.investorProfile?.firm || reg.firm || "",
        isAccredited: user.investorProfile?.isAccredited || reg.isAccredited || "Yes",
        ticketMin: user.investorProfile?.ticketMin ?? reg.ticketMin ?? 25000,
        ticketMax: user.investorProfile?.ticketMax ?? reg.ticketMax ?? 250000,
        PreferredStage: psArr.map((id: string, idx: number) => ({
          preferredStageId: id,
          preferredStageName: psNames[idx] || id
        })),
        preferredStage: psArr,
        preferredStageIds: reg.preferredStageIds || psArr,
        FocusAreas: faArr.map((id: string, idx: number) => ({
          focusAreaId: id,
          focusAreaName: faNames[idx] || id
        })),
        focusAreas: faArr,
        focusAreaIds: reg.focusAreaIds || faArr,
        city: user.city || reg.city || "",
        country: user.country || reg.country || "",
        countryId: cntryId,
        state: user.state || reg.state || "",
        stateId: reg.stateId || user.state || "",
        status: user.status || "active",
        verified: Boolean(user.isVerified || user.verified),
        role: user.role || 'investor',
        registrationData: reg,
        savedData: true,
        isSaved: true
      }));
    }

    return res.json(successResponse(`Details retrieved for ${modelName}`, { id: req.params.id, status: 'active' }));
  } catch (error) { next(error); }
};
