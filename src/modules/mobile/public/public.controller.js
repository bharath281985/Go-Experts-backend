import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
import { shapeProjects, shapeProject } from '../../../services/mobile/project-shape.service.js';
import { parsePagination, parseProjectListQuery, } from '../../../services/mobile/project-list-query.service.js';
const isLegacySkillSchemaError = (error) => {
    const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    return (msg.includes('skillcategory') ||
        msg.includes('categoryid') ||
        msg.includes('category_id') ||
        msg.includes('unknown column') ||
        msg.includes('does not exist'));
};
const readCatalogParam = (req, ...keys) => {
    for (const key of keys) {
        const fromQuery = req.query[key];
        if (typeof fromQuery === 'string' && fromQuery.trim())
            return fromQuery.trim();
        if (Array.isArray(fromQuery) && typeof fromQuery[0] === 'string' && fromQuery[0].trim()) {
            return fromQuery[0].trim();
        }
        const fromBody = req.body?.[key];
        if (typeof fromBody === 'string' && fromBody.trim())
            return fromBody.trim();
        if (typeof fromBody === 'number')
            return String(fromBody);
    }
    return undefined;
};
const loadCategoryRows = async (search) => {
    const nameFilter = search
        ? { name: { contains: search } }
        : undefined;
    try {
        const categories = await prisma.skillCategory.findMany({
            where: { status: 'active', ...(nameFilter ?? {}) },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            select: { id: true, name: true, sortOrder: true },
        });
        if (categories.length > 0)
            return categories;
    }
    catch (error) {
        if (!isLegacySkillSchemaError(error))
            throw error;
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
export const getHomeData = async (req, res, next) => {
    try {
        const stats = {
            freelancers: await prisma.user.count({ where: { role: 'freelancer', status: 'active' } }),
            projects: await prisma.project.count({ where: { status: 'open' } }),
            startups: await prisma.founderProfile.count()
        };
        return res.json(successResponse('Home data retrieved', stats));
    }
    catch (error) {
        next(error);
    }
};
export const getCategories = async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req);
        const search = readCatalogParam(req, 'search', 'q') || '';
        const all = await loadCategoryRows(search);
        const total = all.length;
        const categories = all.slice(skip, skip + limit);
        return res.json(successResponse('Categories retrieved', categories, {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        }));
    }
    catch (error) {
        if (isLegacySkillSchemaError(error)) {
            return res.json(successResponse('Categories retrieved', [], { page: 1, limit: 20, total: 0, totalPages: 0 }));
        }
        next(error);
    }
};
export const getSkills = async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req);
        // Prefer query string (GET); body is fallback for older clients.
        const categoryId = readCatalogParam(req, 'categoryId', 'category_id');
        const search = readCatalogParam(req, 'search', 'q') || '';
        const respond = (skills, total) => res.json(successResponse('Skills retrieved', skills, {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit) || 1),
        }));
        const nameFilter = search ? { name: { contains: search } } : {};
        // Resolve category/industry so we know when "uncategorized" tech skills apply.
        let categoryName;
        if (categoryId) {
            const fromCategory = await prisma.skillCategory
                .findFirst({ where: { id: categoryId }, select: { name: true } })
                .catch(() => null);
            const fromIndustry = fromCategory ??
                (await prisma.industry
                    .findFirst({ where: { id: categoryId }, select: { name: true } })
                    .catch(() => null));
            categoryName = fromIndustry?.name;
        }
        const isTechnology = !!categoryName && categoryName.trim().toLowerCase() === 'technology';
        try {
            const where = {
                status: 'active',
                ...nameFilter,
            };
            if (categoryId) {
                // Strict category filter. Uncategorized skills (null category_id) only
                // belong to Technology — never return the full list for other categories.
                if (isTechnology) {
                    where.OR = [{ categoryId }, { categoryId: null }];
                }
                else {
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
        }
        catch (error) {
            if (!isLegacySkillSchemaError(error))
                throw error;
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
    }
    catch (error) {
        next(error);
    }
};
export const getIndustries = async (req, res, next) => {
    try {
        const industries = await prisma.industry.findMany({ where: { status: 'active' } });
        return res.json(successResponse('Industries retrieved', industries));
    }
    catch (error) {
        next(error);
    }
};
export const getFreelancers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
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
    }
    catch (error) {
        next(error);
    }
};
export const getClients = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
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
    }
    catch (error) {
        next(error);
    }
};
export const getInvestors = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
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
    }
    catch (error) {
        next(error);
    }
};
const COUNTRY_INFO_MAP = {
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
        const mod = await import('country-state-city');
        return mod;
    }
    catch {
        return null;
    }
};
export const getCountries = async (req, res, next) => {
    try {
        const dbCountries = await prisma.country.findMany({ where: { status: 'active' }, orderBy: { name: 'asc' } }).catch(() => []);
        const csc = await getCSC();
        if (dbCountries.length > 0) {
            const enriched = dbCountries.map((row) => {
                const normName = (row.name || '').trim().toLowerCase();
                const info = COUNTRY_INFO_MAP[normName];
                let cscInfo = null;
                if (csc?.Country) {
                    cscInfo = csc.Country.getAllCountries().find((c) => c.name.toLowerCase() === normName || c.isoCode.toLowerCase() === (row.code || '').toLowerCase());
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
            const all = csc.Country.getAllCountries().map((c) => ({
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
    }
    catch (error) {
        next(error);
    }
};
export const getStates = async (req, res, next) => {
    try {
        const rawParam = String(req.query.countryCode || req.query.countryId || req.query.country || 'IN').trim();
        let isoCode = rawParam.toUpperCase();
        if (rawParam.length > 3) {
            const dbRow = await prisma.country.findFirst({ where: { OR: [{ id: rawParam }, { name: rawParam }] } }).catch(() => null);
            if (dbRow?.code) {
                isoCode = dbRow.code.toUpperCase();
            }
            else if (dbRow?.name) {
                const info = COUNTRY_INFO_MAP[dbRow.name.trim().toLowerCase()];
                if (info?.code)
                    isoCode = info.code;
            }
        }
        const csc = await getCSC();
        let states = [];
        if (csc?.State) {
            states = csc.State.getStatesOfCountry(isoCode).map((s) => ({
                id: s.isoCode,
                code: s.isoCode,
                name: s.name,
                countryCode: s.countryCode,
            }));
        }
        return res.json(successResponse('States retrieved', states));
    }
    catch (error) {
        next(error);
    }
};
export const getStartups = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
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
    }
    catch (error) {
        next(error);
    }
};
export const getProjects = async (req, res, next) => {
    try {
        const { where, orderBy, page, limit, skip } = parseProjectListQuery(req, { kind: 'public' });
        const [projects, total] = await Promise.all([
            prisma.project.findMany({ where, skip, take: limit, orderBy }),
            prisma.project.count({ where }),
        ]);
        const viewerId = req.user?.id;
        const shaped = await shapeProjects(projects, viewerId);
        return res.json(successResponse('Projects retrieved', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const shareProject = async (req, res, next) => {
    try {
        const platform = String(req.body?.platform || 'other').trim().toLowerCase() || 'other';
        const existing = await prisma.project.findFirst({
            where: { id: req.params.id, deletedAt: null },
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        let shareCount = existing.shareCount ?? 0;
        try {
            const updated = await prisma.project.update({
                where: { id: existing.id },
                data: { shareCount: { increment: 1 } },
            });
            shareCount = updated.shareCount ?? shareCount + 1;
        }
        catch {
            shareCount += 1;
        }
        return res.json(successResponse('Project share recorded', {
            projectId: existing.id,
            platform,
            shareCount,
            shareUrl: `https://goexperts.in/projects/${existing.id}`,
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getPricing = async (req, res, next) => {
    try {
        const pricing = await prisma.subscriptionPlan.findMany({ where: { status: 'active' } });
        return res.json(successResponse('Pricing retrieved', pricing));
    }
    catch (error) {
        next(error);
    }
};
export const getBlogs = async (req, res, next) => {
    try {
        return res.json(successResponse('Blogs retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const getFaqs = async (req, res, next) => {
    try {
        return res.json(successResponse('FAQs retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const getTestimonials = async (req, res, next) => {
    try {
        return res.json(successResponse('Testimonials retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const submitContact = async (req, res, next) => {
    try {
        return res.json(successResponse('Contact form submitted'));
    }
    catch (error) {
        next(error);
    }
};
export const search = async (req, res, next) => {
    try {
        return res.json(successResponse('Search results', { freelancers: [], projects: [] }));
    }
    catch (error) {
        next(error);
    }
};
export const getById = (modelName) => async (req, res, next) => {
    try {
        if (modelName === 'project') {
            const project = await prisma.project.findFirst({
                where: { id: req.params.id, deletedAt: null },
            });
            if (!project) {
                return res.status(404).json({ success: false, message: 'Project not found' });
            }
            const viewerId = req.user?.id;
            const shaped = await shapeProject(project, viewerId);
            return res.json(successResponse('Project details', shaped));
        }
        
        let selectFields = {
            id: true, fullName: true, avatarUrl: true, city: true, country: true, bio: true, isVerified: true, createdAt: true
        };

        let data = null;
        if (modelName === 'freelancer') {
            data = await prisma.user.findFirst({
                where: { id: req.params.id, role: 'freelancer', status: 'active', deletedAt: null },
                select: { ...selectFields, freelancerProfile: { select: { skills: true, hourlyRate: true, experience: true } } }
            });
        } else if (modelName === 'client') {
            data = await prisma.user.findFirst({
                where: { id: req.params.id, role: 'client', status: 'active', deletedAt: null },
                select: { ...selectFields, clientProfile: { select: { company: true, industry: true } } }
            });
        } else if (modelName === 'investor') {
            const id = req.params.id;
            let user = null;
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
        } else if (modelName === 'startup') {
            data = await prisma.user.findFirst({
                where: { id: req.params.id, role: 'founder', status: 'active', deletedAt: null },
                select: { ...selectFields, founderProfile: { select: { startupName: true, industry: true, stage: true, teamSize: true, raised: true } } }
            });
        }

        if (!data) {
            return res.status(404).json({ success: false, message: `${modelName} not found` });
        }

        return res.json(successResponse(`${modelName} details retrieved`, data));
    }
    catch (error) {
        next(error);
    }
};
