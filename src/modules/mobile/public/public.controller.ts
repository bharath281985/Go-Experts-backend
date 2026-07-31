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

type CategoryRow = { id: string; name: string; sortOrder: number };

const loadCategoryRows = async (search: string): Promise<CategoryRow[]> => {
  const nameFilter = search
    ? { name: { contains: search } }
    : undefined;

  try {
    const categories = await prisma.skillCategory.findMany({
      where: { status: 'active', ...(nameFilter ?? {}) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, sortOrder: true },
    });
    if (categories.length > 0) return categories;
  } catch (error) {
    if (!isLegacySkillSchemaError(error)) throw error;
  }

  // skill_categories may be empty — industries already hold the catalog.
  const industries = await prisma.industry.findMany({
    where: { status: 'active', ...(nameFilter ?? {}) },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  return industries.map((row, index) => ({
    id: row.id,
    name: row.name,
    sortOrder: index,
  }));
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
    const all = await loadCategoryRows(search);
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
        // Strict category filter. Uncategorized skills (null category_id) only
        // belong to Technology — never return the full list for other categories.
        if (isTechnology) {
          where.OR = [{ categoryId }, { categoryId: null }];
        } else {
          where.categoryId = categoryId;
        }
      }

      const [skills, total] = await Promise.all([
        prisma.skill.findMany({
          where,
          orderBy: { name: 'asc' },
          skip,
          take: limit,
          select: { id: true, name: true, categoryId: true },
        }),
        prisma.skill.count({ where }),
      ]);

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
    let industries = await prisma.industry.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } });
    if (industries.length === 0) {
      const defaults = [
        'Technology', 'Finance', 'HealthTech', 'E-Commerce', 'Education',
        'Agriculture', 'Logistics', 'Real Estate', 'Media & Entertainment', 'Marketing'
      ];
      industries = defaults.map((name, index) => ({ id: `ind_${index + 1}`, name, status: 'active', createdAt: new Date(), updatedAt: new Date() } as any));
    }
    return res.json(successResponse('Industries retrieved', industries));
  } catch (error) { next(error); }
};

export const getExperienceLevels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const levels = [
      { id: 'exp_1', label: 'Beginner (0-2 yrs)', value: 'Beginner' },
      { id: 'exp_2', label: 'Intermediate (2-5 yrs)', value: 'Intermediate' },
      { id: 'exp_3', label: 'Senior (5-8 yrs)', value: 'Senior' },
      { id: 'exp_4', label: 'Expert (8+ yrs)', value: 'Expert' }
    ];
    return res.json(successResponse('Experience levels retrieved', levels));
  } catch (error) { next(error); }
};

export const getStartupStages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = [
      { id: 'stage_1', label: 'Idea Phase', value: 'Idea' },
      { id: 'stage_2', label: 'MVP / Prototype', value: 'MVP' },
      { id: 'stage_3', label: 'Early Traction', value: 'Early Traction' },
      { id: 'stage_4', label: 'Growth & Scaling', value: 'Growth' },
      { id: 'stage_5', label: 'Pre-Seed / Seed', value: 'Seed' },
      { id: 'stage_6', label: 'Series A / B', value: 'Series A' }
    ];
    return res.json(successResponse('Startup stages retrieved', stages));
  } catch (error) { next(error); }
};

export const getCompanySizes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sizes = [
      { id: 'size_1', label: '1-10 employees', value: '1-10' },
      { id: 'size_2', label: '11-50 employees', value: '11-50' },
      { id: 'size_3', label: '51-200 employees', value: '51-200' },
      { id: 'size_4', label: '201-500 employees', value: '201-500' },
      { id: 'size_5', label: '500+ employees', value: '500+' }
    ];
    return res.json(successResponse('Company sizes retrieved', sizes));
  } catch (error) { next(error); }
};

export const getTicketSizes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tickets = [
      { id: 'tkt_1', label: '₹1 Lakh - ₹5 Lakhs', min: 100000, max: 500000 },
      { id: 'tkt_2', label: '₹5 Lakhs - ₹25 Lakhs', min: 500000, max: 2500000 },
      { id: 'tkt_3', label: '₹25 Lakhs - ₹1 Crore', min: 2500000, max: 10000000 },
      { id: 'tkt_4', label: '₹1 Crore - ₹5 Crores', min: 10000000, max: 50000000 },
      { id: 'tkt_5', label: '₹5 Crores+', min: 50000000, max: 250000000 }
    ];
    return res.json(successResponse('Ticket sizes retrieved', tickets));
  } catch (error) { next(error); }
};

export const getInvestorTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = [
      { id: 'invtype_1', label: 'Angel', value: 'Angel' },
      { id: 'invtype_2', label: 'Individual', value: 'Individual' },
      { id: 'invtype_3', label: 'Family office', value: 'Family office' },
      { id: 'invtype_4', label: 'VC', value: 'VC' },
      { id: 'invtype_5', label: 'Corporate', value: 'Corporate' },
      { id: 'invtype_6', label: 'PE', value: 'PE' },
      { id: 'invtype_7', label: 'Incubator/Accelerator', value: 'Incubator/Accelerator' },
      { id: 'invtype_8', label: 'NRI Investor', value: 'NRI Investor' }
    ];
    return res.json(successResponse('Investor types retrieved', types));
  } catch (error) { next(error); }
};

export const getFounderTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = [
      { id: 'ft_1', label: 'Idea Creator', value: 'Idea Creator' },
      { id: 'ft_2', label: 'Solo Founder', value: 'Solo Founder' },
      { id: 'ft_3', label: 'Co-Founder', value: 'Co-Founder' },
      { id: 'ft_4', label: 'Startup Team', value: 'Startup Team' },
      { id: 'ft_5', label: 'Existing Business Founder', value: 'Existing Business Founder' },
      { id: 'ft_6', label: 'Student Founder', value: 'Student Founder' },
      { id: 'ft_7', label: 'Tech Founder', value: 'Tech Founder' },
      { id: 'ft_8', label: 'Non-Tech Founder', value: 'Non-Tech Founder' }
    ];
    return res.json(successResponse('Founder types retrieved', types));
  } catch (error) { next(error); }
};

export const getBusinessTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = [
      { id: 'bt_1', label: 'Individual Client', value: 'Individual Client' },
      { id: 'bt_2', label: 'Small Business', value: 'Small Business' },
      { id: 'bt_3', label: 'Startup', value: 'Startup' },
      { id: 'bt_4', label: 'Agency', value: 'Agency' },
      { id: 'bt_5', label: 'Enterprise', value: 'Enterprise' },
      { id: 'bt_6', label: 'Shop Owner', value: 'Shop Owner' },
      { id: 'bt_7', label: 'Service Provider', value: 'Service Provider' },
      { id: 'bt_8', label: 'Manufacturer', value: 'Manufacturer' },
      { id: 'bt_9', label: 'Franchise Owner', value: 'Franchise Owner' }
    ];
    return res.json(successResponse('Business types retrieved', types));
  } catch (error) { next(error); }
};

const SERVICES_TAXONOMY: Record<string, string[]> = {
  "Technology": ["SaaS", "AI Tools", "Mobile App", "Web Platform", "Marketplace", "Cloud Software", "Cybersecurity", "Automation"],
  "E-commerce": ["Fashion", "Grocery", "Electronics", "Home Products", "B2B Marketplace", "Hyperlocal Delivery"],
  "Services": ["Home Services", "Professional Services", "Repair Services", "Beauty & Wellness", "Local Business Services"],
  "Fintech": ["Payments", "Lending", "Investment", "Insurance", "Accounting", "Taxation"],
  "Education": ["Online Learning", "Coaching", "Skill Training", "LMS Platform", "Career Guidance"],
  "Healthcare": ["Doctor Booking", "Pharmacy", "Diagnostics", "Health Tracking", "Wellness"],
  "Real Estate": ["Property Listing", "Rental Platform", "PG / Hostel", "Construction Services", "Interior Design"],
  "Food & Beverage": ["Cloud Kitchen", "Restaurant Tech", "Food Delivery", "Packaged Food", "Catering"]
};

export const getServicesTaxonomy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = String(req.query.category || req.query.primaryCategory || '').trim();
    if (category && SERVICES_TAXONOMY[category]) {
      return res.json(successResponse(`Sub-categories retrieved for ${category}`, SERVICES_TAXONOMY[category].map((sub, i) => ({ id: `sub_${i + 1}`, label: sub, value: sub }))));
    }
    const categories = Object.keys(SERVICES_TAXONOMY).map((cat, i) => ({
      id: `cat_${i + 1}`,
      name: cat,
      label: cat,
      value: cat,
      subCategories: SERVICES_TAXONOMY[cat]
    }));
    return res.json(successResponse('Services taxonomy retrieved', categories));
  } catch (error) { next(error); }
};

export const getProjectCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = String(req.query.category || '').trim();
    if (category && SERVICES_TAXONOMY[category]) {
      return res.json(successResponse(`Project subcategories retrieved for ${category}`, SERVICES_TAXONOMY[category].map((sub, i) => ({ id: `psub_${i + 1}`, label: sub, value: sub }))));
    }
    const categories = Object.keys(SERVICES_TAXONOMY).map((cat, i) => ({
      id: `pcat_${i + 1}`,
      name: cat,
      label: cat,
      value: cat,
      subCategories: SERVICES_TAXONOMY[cat]
    }));
    return res.json(successResponse('Project categories retrieved', categories));
  } catch (error) { next(error); }
};

export const getTeamSizes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sizes = [
      { id: 'team_1', label: '1 (Solo Founder)', value: 1 },
      { id: 'team_2', label: '2-5 members', value: 5 },
      { id: 'team_3', label: '6-10 members', value: 10 },
      { id: 'team_4', label: '11-25 members', value: 25 },
      { id: 'team_5', label: '25+ members', value: 50 }
    ];
    return res.json(successResponse('Team sizes retrieved', sizes));
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

    return res.json(successResponse(`Details retrieved for ${modelName}`, { id: req.params.id }));
  } catch (error) { next(error); }
};
