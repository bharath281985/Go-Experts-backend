import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { listFreelancersCompat } from "../../common/helpers/prisma-compat.js";
import {
  getHomeCmsContent,
  getHomePagePayload,
  getHomePageFallbackPayload,
  getPublicCategories,
  getPublicPlatformStats,
  getPublicSkills,
} from "../../services/public/home.service.js";
import { parseCatalogListBody, parseFreelancersListBody, parseSkillsListBody } from "../../common/helpers/catalog-body.js";
import {
  getPublicFreelancerFilters,
  listPublicExperienceLevels,
  listPublicFreelancers,
} from "../../services/public/freelancers.service.js";
import {
  getPostProjectPagePayload,
  listPublicProjects,
} from "../../services/public/projects.service.js";
import { getSettingsSection } from "../../services/settings/settings.service.js";

const router = Router();

router.get("/settings/branding", async (req: Request, res: Response) => {
  const result = await getSettingsSection("branding");
  res.json(result);
});

router.get("/settings/general", async (req: Request, res: Response) => {
  const result = await getSettingsSection("general");
  res.json(result);
});

const COUNTRY_INFO_MAP: Record<string, { code: string; phoneCode: string; flag: string; currencyCode: string }> = {
  "india": { code: "IN", phoneCode: "+91", flag: "🇮🇳", currencyCode: "INR" },
  "usa": { code: "US", phoneCode: "+1", flag: "🇺🇸", currencyCode: "USD" },
  "uk": { code: "GB", phoneCode: "+44", flag: "🇬🇧", currencyCode: "GBP" },
  "uae": { code: "AE", phoneCode: "+971", flag: "🇦🇪", currencyCode: "AED" },
  "canada": { code: "CA", phoneCode: "+1", flag: "🇨🇦", currencyCode: "CAD" },
  "australia": { code: "AU", phoneCode: "+61", flag: "🇦🇺", currencyCode: "AUD" },
  "germany": { code: "DE", phoneCode: "+49", flag: "🇩🇪", currencyCode: "EUR" },
  "france": { code: "FR", phoneCode: "+33", flag: "🇫🇷", currencyCode: "EUR" },
  "singapore": { code: "SG", phoneCode: "+65", flag: "🇸🇬", currencyCode: "SGD" },
  "japan": { code: "JP", phoneCode: "+81", flag: "🇯🇵", currencyCode: "JPY" },
};

router.get("/countries", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const countries = await prisma.country.findMany({
      where: { status: "active" },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
    const enriched = countries.map((row) => {
      const normName = (row.name || "").trim().toLowerCase();
      const info = COUNTRY_INFO_MAP[normName];
      return {
        ...row,
        code: row.code || info?.code || null,
        phoneCode: row.phoneCode || info?.phoneCode || null,
        flag: row.flag || info?.flag || null,
        currencyCode: row.currencyCode || info?.currencyCode || null,
      };
    });
    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    next(err);
  }
});

router.get("/states", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawParam = String(req.query.countryCode || req.query.countryId || req.query.country || "IN").trim();
    let isoCode = rawParam.toUpperCase();

    if (rawParam.length > 3) {
      const dbRow = await prisma.country.findFirst({
        where: { OR: [{ id: rawParam }, { name: rawParam }] },
      }).catch(() => null);
      if (dbRow?.code) {
        isoCode = dbRow.code.toUpperCase();
      } else if (dbRow?.name) {
        const info = COUNTRY_INFO_MAP[dbRow.name.trim().toLowerCase()];
        if (info?.code) isoCode = info.code;
      }
    }

    let states: any[] = [];
    try {
      // @ts-ignore
      const csc = await import("country-state-city");
      if (csc?.State) {
        states = csc.State.getStatesOfCountry(isoCode).map((s: any) => ({
          id: s.isoCode,
          code: s.isoCode,
          name: s.name,
          countryCode: s.countryCode,
        }));
      }
    } catch (e) {
      console.error("Failed to dynamically import country-state-city in public.routes:", e);
    }

    res.json({ success: true, count: states.length, data: states, rows: states });
  } catch (err) {
    next(err);
  }
});

router.get("/currencies", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const currencies = await prisma.currency.findMany({
      where: { status: "active" },
      orderBy: [{ isBase: "desc" }, { name: "asc" }],
    });
    res.json({ success: true, count: currencies.length, data: currencies });
  } catch (err) {
    next(err);
  }
});

router.get("/detect-location", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const headerCountry = (req.headers["cf-ipcountry"] || req.headers["x-country-code"]) as string;

    let countryCode = (headerCountry && headerCountry.length === 2 ? headerCountry : "").toUpperCase();

    // Look up country by header country code or default country setting
    let matchedCountry = null;
    if (countryCode) {
      matchedCountry = await prisma.country.findFirst({
        where: { code: countryCode, status: "active" },
      });
    }

    if (!matchedCountry) {
      matchedCountry = await prisma.country.findFirst({
        where: { isDefault: true, status: "active" },
      });
    }

    if (!matchedCountry) {
      matchedCountry = await prisma.country.findFirst({
        where: { status: "active" },
      });
    }

    // Match currency for country
    let matchedCurrency = null;
    if (matchedCountry?.currencyCode) {
      matchedCurrency = await prisma.currency.findFirst({
        where: { code: matchedCountry.currencyCode, status: "active" },
      });
    }

    if (!matchedCurrency) {
      matchedCurrency = await prisma.currency.findFirst({
        where: { isDefault: true, status: "active" },
      });
    }

    res.json({
      success: true,
      ip: clientIp,
      detectedCountry: matchedCountry?.name || "India",
      countryCode: matchedCountry?.code || "IN",
      phoneCode: matchedCountry?.phoneCode || "+91",
      flag: matchedCountry?.flag || "🇮🇳",
      currencyCode: matchedCurrency?.code || "INR",
      currencySymbol: matchedCurrency?.symbol || "₹",
      currency: matchedCurrency,
      country: matchedCountry,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/google-maps-config", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const gmapsSettings = await getSettingsSection("google_maps");
    const data = gmapsSettings?.data || {};
    res.json({
      success: true,
      data: {
        apiKey: data.apiKey || "",
        enablePlacesAutocomplete: Boolean(data.enablePlacesAutocomplete ?? true),
        enableGeocoding: Boolean(data.enableGeocoding ?? true),
        defaultLatitude: Number(data.defaultLatitude ?? 20.5937),
        defaultLongitude: Number(data.defaultLongitude ?? 78.9629),
        defaultZoom: Number(data.defaultZoom ?? 5),
        countryRestriction: data.countryRestriction || "IN",
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/fix-db", async (req: Request, res: Response) => {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE freelancer_profiles ADD COLUMN verification_json TEXT;`);
  } catch (e: any) { console.log(e.message); }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE freelancer_profiles ADD COLUMN portfolio_json TEXT;`);
  } catch (e: any) { console.log(e.message); }
  return res.json({ success: true, message: "Database fields added! The editing error should be resolved." });
});

function parseListParams(req: Request) {
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 50;
  const search = (req.query.search as string) || undefined;
  const orderBy = (req.query.orderBy as string) || undefined;
  const ascending = req.query.ascending === "true" || req.query.ascending === undefined;

  let filters: any = {};
  if (req.query.filters) {
    try {
      filters = JSON.parse(req.query.filters as string);
    } catch {
      filters = {};
    }
  }

  return { page, pageSize, search, orderBy, ascending, filters };
}

function parseFreelancerQueryFilters(req: Request) {
  const { page, pageSize, search, orderBy, ascending, filters } = parseListParams(req);

  const experienceFromQuery = typeof req.query.experience === "string"
    ? req.query.experience.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

  const skillsFromQuery = typeof req.query.skills === "string"
    ? req.query.skills.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;

  const rateMin = Number(req.query.rateMin);
  const rateMax = Number(req.query.rateMax);

  return parseFreelancersListBody({
    page,
    pageSize,
    search,
    orderBy,
    ascending: ascending === true,
    categoryId: req.query.categoryId,
    industryId: req.query.industryId,
    experience: experienceFromQuery?.length
      ? experienceFromQuery
      : filters?.freelancerProfile?.experience?.in,
    skills: skillsFromQuery,
    rateMin: Number.isFinite(rateMin) ? rateMin : filters?.freelancerProfile?.hourlyRate?.gte,
    rateMax: Number.isFinite(rateMax) ? rateMax : filters?.freelancerProfile?.hourlyRate?.lte,
  });
}

function getPrismaDelegate(modelName: string) {
  const camelCase = modelName.charAt(0).toLowerCase() + modelName.slice(1);
  return (prisma as any)[camelCase] ?? (prisma as any)[modelName];
}

async function listModel({
  req,
  res,
  next,
  modelName,
  searchColumns,
  include,
  defaultWhere,
  forceWhere,
}: {
  req: Request;
  res: Response;
  next: NextFunction;
  // Prisma runtime exposes both camelCase and PascalCase keys, but TS types only
  // include the camelCase ones. We keep this flexible to avoid type issues.
  modelName: string;
  searchColumns: string[];
  include?: Record<string, any>;
  defaultWhere?: Record<string, any>;
  forceWhere?: Record<string, any>;
}) {
  try {
    const { page, pageSize, search, orderBy, ascending, filters } = parseListParams(req);

    // Start with filters from client, then apply defaults/overrides.
    const where: any = { ...(filters || {}), ...(defaultWhere || {}) };
    if (forceWhere) Object.assign(where, forceWhere);

    // Search columns (OR contains) if provided.
    if (search && searchColumns.length > 0) {
      where.OR = searchColumns.map((col) => ({
        [col]: { contains: search },
      }));
    }

    const db: any = getPrismaDelegate(modelName);
    if (!db) {
      throw new Error(`Model ${String(modelName)} does not exist in Prisma Client.`);
    }

    // Exclude soft deleted rows when the model supports deletedAt.
    const modelFields = (prisma as any)._dmmf?.modelMap?.[modelName]?.fields || [];
    const hasDeletedAt = modelFields.some((f: any) => f.name === "deletedAt");
    if (hasDeletedAt && where.deletedAt === undefined) {
      where.deletedAt = null;
    }

    const total = await db.count({ where });
    const rows = await db.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: orderBy
        ? { [orderBy]: ascending ? "asc" : "desc" }
        : { createdAt: "desc" },
      ...(include ? { include } : {}),
    });

    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
}

router.get("/freelancers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseFreelancerQueryFilters(req);
    const { rows, total, degraded, categoryId } = await listPublicFreelancers(body);
    res.json({ success: true, rows, total, degraded, categoryId });
  } catch (err) {
    next(err);
  }
});

router.post("/freelancers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseFreelancersListBody(req.body ?? {});
    const { rows, total, degraded, categoryId } = await listPublicFreelancers(body);
    res.json({ success: true, rows, total, degraded, categoryId });
  } catch (err) {
    next(err);
  }
});

router.post("/experience_levels", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseCatalogListBody(req.body ?? {});
    const { rows, total } = await listPublicExperienceLevels(body.pageSize ?? 50);
    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

router.get("/experience_levels", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const { rows, total } = await listPublicExperienceLevels(pageSize);
    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

router.get("/freelancers/filters", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPublicFreelancerFilters();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/freelancers/filters", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPublicFreelancerFilters();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/home", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getHomePagePayload();
    res.json({ success: true, data });
  } catch (err) {
    console.error("Public home payload failed, returning fallback:", err);
    res.json({ success: true, data: getHomePageFallbackPayload() });
  }
});

router.get("/cms_pages", async (req: Request, res: Response, next: NextFunction) => {
  await listModel({
    req,
    res,
    next,
    modelName: "CmsPage",
    searchColumns: ["name", "category"],
    defaultWhere: { status: "active" },
  });
});

router.get("/cms_pages/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.cmsPage.findFirst({
      where: {
        name: req.params.name,
        status: "active",
        deletedAt: null,
      },
    });

    if (!row) {
      if (req.params.name === "home") {
        const cms = await getHomeCmsContent();
        return res.json({ success: true, data: { name: "home", content: cms } });
      }
      return res.status(404).json({ success: false, message: "CMS page not found" });
    }

    let content = null;
    if (row.content) {
      try {
        content = JSON.parse(row.content);
      } catch {
        content = row.content;
      }
    }

    res.json({ success: true, data: { ...row, content } });
  } catch (e) {
    next(e);
  }
});

const getPageHandler = (pageName: string) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.cmsPage.findFirst({
      where: {
        name: pageName,
        status: "active",
        deletedAt: null,
      },
    });

    if (!row) {
      return res.status(404).json({ success: false, message: `${pageName} page not found` });
    }

    let content = null;
    if (row.content) {
      try {
        content = JSON.parse(row.content);
      } catch {
        content = row.content;
      }
    }

    res.json({ success: true, data: { ...row, content } });
  } catch (e) {
    next(e);
  }
};

router.get("/cms_pages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageName = req.query.name;
    if (!pageName) {
      return res.status(400).json({ success: false, message: "Query parameter 'name' is required" });
    }

    const row = await prisma.cmsPage.findFirst({
      where: {
        name: String(pageName),
        status: "active",
        deletedAt: null,
      },
    });

    if (!row) {
      return res.status(404).json({ success: false, message: `Page '${pageName}' not found` });
    }

    let content = null;
    if (row.content) {
      try {
        content = JSON.parse(row.content);
      } catch {
        content = row.content;
      }
    }

    res.json({ success: true, data: { ...row, content } });
  } catch (e) {
    next(e);
  }
});

router.get("/about", getPageHandler("About"));
router.get("/careers", getPageHandler("Careers"));
router.get("/help_center", getPageHandler("Help Center"));
router.get("/help-center", getPageHandler("Help Center"));
router.get("/contact", getPageHandler("Contact"));
router.get("/legal", getPageHandler("Legal"));
router.get("/privacy", getPageHandler("Privacy"));
router.get("/refund", getPageHandler("Refund Policy"));
router.get("/refund-policy", getPageHandler("Refund Policy"));
router.get("/faq", getPageHandler("FAQ"));

router.get("/industries", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const { rows, total } = await getPublicCategories({ pageSize });
    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

router.post("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseCatalogListBody(req.body ?? {});
    const industryId = (req.body?.industryId || req.body?.industry_id || req.body?.industry) as string | undefined;
    const { rows, total } = await getPublicCategories({ ...body, industryId });
    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

router.get("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.search || req.query.q) as string | undefined;
    const industryId = (req.query.industryId || req.query.industry_id || req.query.industry) as string | undefined;
    const { rows, total } = await getPublicCategories({ page, pageSize, search, industryId });
    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

router.post("/skills", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseSkillsListBody(req.body ?? {});
    const { rows, total, degraded, industry, categoryId } = await getPublicSkills(body);

    res.json({
      success: true,
      rows,
      total,
      degraded,
      categoryId: categoryId ?? null,
      industry: industry ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/skills", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const search = (req.query.search as string) || undefined;

    let categoryId = (req.query.categoryId as string) || (req.query.industryId as string) || undefined;
    let industry: string | undefined;

    if (req.query.filters) {
      try {
        const filters = JSON.parse(req.query.filters as string);
        categoryId = categoryId || filters.categoryId || filters.industryId;
        industry = filters.industry ?? filters.category;
      } catch {
        industry = undefined;
      }
    }

    const { rows, total, degraded, industry: resolvedIndustry, categoryId: resolvedCategoryId } =
      await getPublicSkills({
        page,
        pageSize,
        search,
        categoryId,
        industry,
      });

    res.json({
      success: true,
      rows,
      total,
      degraded,
      categoryId: resolvedCategoryId ?? null,
      industry: resolvedIndustry ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/stats", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getPublicPlatformStats();
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

router.get("/post-project", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPostProjectPagePayload();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/post-project", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPostProjectPagePayload();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseCatalogListBody({
      page: req.query.page,
      pageSize: req.query.pageSize,
      search: req.query.search,
    });
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const { rows, total } = await listPublicProjects({
      page: body.page,
      pageSize: body.pageSize,
      search: body.search,
      category,
    });
    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

router.post("/projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseCatalogListBody(req.body ?? {});
    const category =
      typeof req.body?.category === "string"
        ? req.body.category
        : undefined;
    const categoryId =
      typeof req.body?.categoryId === "string"
        ? req.body.categoryId
        : undefined;
    const { rows, total } = await listPublicProjects({
      page: body.page,
      pageSize: body.pageSize,
      search: body.search,
      category,
      categoryId,
    });
    res.json({ success: true, rows, total });
  } catch (err) {
    next(err);
  }
});

router.get("/pricing_plans", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { status: "active" },
      orderBy: { amount: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        amount: true,
        currency: true,
        duration: true,
        features: true,
        limits: true,
        popular: true,
        recommended: true,
        visibility: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    return res.json({ success: true, data: plans || [], rows: plans || [], total: plans?.length || 0 });
  } catch (err) {
    next(err);
  }
});

router.get("/business-types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.masterOption.findMany({
      where: { type: "business_type", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: types || [], rows: types || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/business_types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.masterOption.findMany({
      where: { type: "business_type", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: types || [], rows: types || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/team-sizes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sizes = await prisma.masterOption.findMany({
      where: { type: "team_size", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: sizes || [], rows: sizes || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/team_sizes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sizes = await prisma.masterOption.findMany({
      where: { type: "team_size", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: sizes || [], rows: sizes || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/founder-types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.masterOption.findMany({
      where: { type: "founder_type", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: types || [], rows: types || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/startup-stages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = await prisma.masterOption.findMany({
      where: { type: "startup_stage", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: stages || [], rows: stages || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/startup_stages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = await prisma.masterOption.findMany({
      where: { type: "startup_stage", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: stages || [], rows: stages || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/founder_types", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.masterOption.findMany({
      where: { type: "founder_type", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: types || [], rows: types || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/client-goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "client_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/founder-goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "founder_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/founder_goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "founder_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/investment-modes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const modes = await prisma.masterOption.findMany({
      where: { type: "investment_mode", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: modes || [], rows: modes || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/investment_modes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const modes = await prisma.masterOption.findMany({
      where: { type: "investment_mode", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: modes || [], rows: modes || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/investor-goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "investor_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/investor_goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "investor_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/client_goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "client_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/expansion-goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "expansion_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/expansion_goals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goals = await prisma.masterOption.findMany({
      where: { type: "expansion_goal", status: "active" },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, value: true }
    });

    return res.json({ success: true, data: goals || [], rows: goals || [] });
  } catch (err) {
    next(err);
  }
});

router.get("/startup_ideas", async (req: Request, res: Response, next: NextFunction) => {
  await listModel({
    req,
    res,
    next,
    modelName: "StartupIdea",
    searchColumns: ["startup", "founder", "industry"],
    defaultWhere: { status: "active", visibility: "Public" },
  });
});

router.get("/startup_ideas/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idOrSlug = String(req.params.id || "").trim();
    const row = await prisma.startupIdea.findFirst({
      where: {
        deletedAt: null,
        status: "active",
        OR: [
          { id: idOrSlug },
          { startup: { equals: idOrSlug } },
        ],
      },
    });
    if (!row) {
      return res.status(404).json({ success: false, message: "Startup not found" });
    }
    await prisma.startupIdea.update({
      where: { id: row.id },
      data: { views: { increment: 1 } },
    }).catch(() => {});
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/blogs", async (req: Request, res: Response, next: NextFunction) => {
  await listModel({
    req,
    res,
    next,
    modelName: "Blog",
    searchColumns: ["title", "category", "author"],
    defaultWhere: { status: "active" },
  });
});

router.get("/blogs/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = String(req.params.id || "").trim();
    const slugify = (t: string) =>
      t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    let row = await prisma.blog.findFirst({
      where: { id: key, status: "active", deletedAt: null },
    });

    if (!row) {
      const candidates = await prisma.blog.findMany({
        where: { status: "active", deletedAt: null },
        take: 200,
      });
      row = candidates.find((b) => slugify(b.title) === key || slugify(b.title) === slugify(key)) || null;
    }

    if (!row) {
      return res.status(404).json({ success: false, message: "Blog post not found" });
    }

    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = String(req.query.q || req.query.search || "").trim();
    if (!q) {
      return res.json({ success: true, data: { freelancers: [], projects: [], startups: [], blogs: [] } });
    }
    const [freelancers, projects, startups, blogs] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: "freelancer",
          deletedAt: null,
          OR: [
            { fullName: { contains: q } },
            { bio: { contains: q } },
            { freelancerProfile: { skills: { contains: q } } },
          ],
        },
        take: 10,
        include: { freelancerProfile: true },
      }),
      prisma.project.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: q } },
            { category: { contains: q } },
            { technology: { contains: q } },
          ],
        },
        take: 10,
      }),
      prisma.startupIdea.findMany({
        where: {
          deletedAt: null,
          status: "active",
          OR: [
            { startup: { contains: q } },
            { founder: { contains: q } },
            { industry: { contains: q } },
          ],
        },
        take: 10,
      }),
      prisma.blog.findMany({
        where: {
          deletedAt: null,
          status: "active",
          OR: [{ title: { contains: q } }, { category: { contains: q } }, { author: { contains: q } }],
        },
        take: 10,
      }),
    ]);
    res.json({ success: true, data: { freelancers, projects, startups, blogs, q } });
  } catch (err) {
    next(err);
  }
});

router.post("/projects/create", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Prefer authenticated client; allow header Authorization via optional check
    const authHeader = req.headers.authorization;
    let clientLabel = String(req.body?.client || "Anonymous").trim();
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = await import("jsonwebtoken");
        const { env } = await import("../../config/env.js");
        const decoded = jwt.default.verify(authHeader.split(" ")[1], env.JWT_SECRET) as {
          id: string;
          type?: string;
          role?: string;
        };
        if (decoded.type === "portal" || decoded.role) {
          const user = await prisma.user.findFirst({ where: { id: decoded.id, deletedAt: null } });
          if (user) {
            if (String(user.role).toLowerCase() !== "client") {
              return res.status(403).json({ success: false, message: "Only clients can create projects" });
            }
            userId = user.id;
            clientLabel = user.fullName || user.email;
            const profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
            if (profile?.company) clientLabel = profile.company;
          }
        }
      } catch {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
      }
    } else {
      return res.status(401).json({ success: false, message: "Authentication required to create a project" });
    }

    const title = String(req.body?.title || "").trim();
    if (!title) {
      return res.status(400).json({ success: false, message: "Project title is required" });
    }

    const project = await prisma.project.create({
      data: {
        title,
        client: clientLabel,
        category: String(req.body?.category || req.body?.industry || "General"),
        technology: String(req.body?.skills || req.body?.technology || ""),
        budgetMin: Number(req.body?.budgetMin ?? req.body?.budget ?? 0) || 0,
        budgetMax: Number(req.body?.budgetMax ?? req.body?.budget ?? 0) || 0,
        timeline: String(req.body?.timeline || req.body?.duration || ""),
        status: "pending",
        description: String(req.body?.description || ""),
      } as any,
    });

    if (userId) {
      await prisma.clientProfile.updateMany({
        where: { userId },
        data: { projectsPosted: { increment: 1 } },
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: project, message: "Project created" });
  } catch (err) {
    next(err);
  }
});

router.get("/faqs", async (req: Request, res: Response, next: NextFunction) => {
  await listModel({
    req,
    res,
    next,
    modelName: "Faq",
    searchColumns: ["question", "answer", "category"],
    defaultWhere: { status: "active" },
  });
});

router.get("/testimonials", async (req: Request, res: Response, next: NextFunction) => {
  await listModel({
    req,
    res,
    next,
    modelName: "Testimonial",
    searchColumns: ["name", "role", "content"],
    defaultWhere: { status: "active" },
  });
});

// Contact / hire forms submit support tickets publicly.
router.post("/support_tickets", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const subject =
      (typeof body.subject === "string" && body.subject.trim()) ||
      (message ? message.slice(0, 120) : "Website inquiry");

    const user =
      (typeof body.user === "string" && body.user.trim()) ||
      [name && email ? `${name} <${email}>` : name || email, company, message]
        .filter(Boolean)
        .join(" | ") ||
      "Guest";

    const created = await prisma.supportTicket.create({
      data: {
        subject,
        user,
        category: (typeof body.category === "string" && body.category.trim()) || "Website Guest Inquiry",
        priority: (typeof body.priority === "string" && body.priority.trim()) || "Medium",
        status: (typeof body.status === "string" && body.status.trim()) || "Open",
        assignedTo: typeof body.assignedTo === "string" ? body.assignedTo : undefined,
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

export default router;

