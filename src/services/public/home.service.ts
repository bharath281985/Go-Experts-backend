
import { prisma } from "../../config/database.js";
import {
  isMissingColumnError,
  listSkillsCompat,
  parseSkillListFilters,
  type SkillListFilters,
} from "../../common/helpers/prisma-compat.js";
import {
  DEFAULT_HOME_CONTENT,
  formatStatValue,
  slugifyCategory,
} from "./home-content.defaults.js";

function parseCmsContent(raw?: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mergeHomeContent(cmsContent: Record<string, unknown> | null) {
  if (!cmsContent) return DEFAULT_HOME_CONTENT;
  return {
    ...DEFAULT_HOME_CONTENT,
    ...cmsContent,
    sections: {
      ...DEFAULT_HOME_CONTENT.sections,
      ...(cmsContent.sections as Record<string, unknown> | undefined),
    },
    cta: {
      ...DEFAULT_HOME_CONTENT.cta,
      ...(cmsContent.cta as Record<string, unknown> | undefined),
    },
  };
}

export async function getHomeCmsContent() {
  try {
    const page = await prisma.cmsPage.findFirst({
      where: {
        name: "home",
        status: "active",
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    const parsed = parseCmsContent(page?.content);
    return mergeHomeContent(parsed);
  } catch {
    return DEFAULT_HOME_CONTENT;
  }
}

export async function getPublicPlatformStats() {
  try {
    const [
      freelancers,
      clients,
      investors,
      startupIdeas,
      projects,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "freelancer", deletedAt: null } }),
      prisma.user.count({ where: { role: "client", deletedAt: null } }),
      prisma.user.count({ where: { role: "investor", deletedAt: null } }),
      prisma.startupIdea.count({ where: { status: "active" } }),
      prisma.project.count(),
    ]);

    return {
      freelancers,
      clients,
      investors,
      startup_ideas: startupIdeas,
      projects,
    };
  } catch {
    return {
      freelancers: 0,
      clients: 0,
      investors: 0,
      startup_ideas: 0,
      projects: 0,
    };
  }
}

async function countFreelancersForIndustry(industryName: string) {
  try {
    return await prisma.user.count({
      where: {
        role: "freelancer",
        deletedAt: null,
        freelancerProfile: {
          industry: industryName,
        },
      },
    });
  } catch (err) {
    if (!isMissingColumnError(err, "industry")) return 0;

    try {
      const { rows } = await listSkillsCompat(1, 200, undefined, { industry: industryName });
      const skillNames = rows.map((row) => row.name).filter(Boolean);
      if (skillNames.length === 0) return 0;

      return await prisma.user.count({
        where: {
          role: "freelancer",
          deletedAt: null,
          OR: skillNames.map((name) => ({
            freelancerProfile: {
              skills: { contains: name },
            },
          })),
        },
      });
    } catch {
      return 0;
    }
  }
}

export async function getPublicCategories(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  industryId?: string;
  industry?: string;
}) {
  try {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const search = options?.search?.trim()?.toLowerCase();
    const targetIndustry = (options?.industryId || options?.industry || "")?.trim();

    let resolvedIndustryId = targetIndustry;
    let resolvedIndustryName = targetIndustry;

    if (targetIndustry) {
      const indRow = await prisma.industry.findFirst({
        where: { OR: [{ id: targetIndustry }, { name: targetIndustry }] },
        select: { id: true, name: true },
      }).catch(() => null);
      if (indRow) {
        resolvedIndustryId = indRow.id;
        resolvedIndustryName = indRow.name;
      }
    }

    const where: any = { status: "active" };
    if (search) where.name = { contains: search };

    if (targetIndustry) {
      const conditions: any[] = [
        { industryId: resolvedIndustryId },
        { industryId: targetIndustry },
      ];
      if (resolvedIndustryId) {
        conditions.push({ industry: { id: resolvedIndustryId } });
      }
      if (resolvedIndustryName) {
        conditions.push({ industry: { name: resolvedIndustryName } });
      }
      where.OR = conditions;
    }

    const dbCategories = await prisma.skillCategory.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).catch(() => []);

    const total = await prisma.skillCategory.count({ where }).catch(() => dbCategories.length);

    const rows = await Promise.all(
      dbCategories.map(async (c) => {
        const count = await countFreelancersForIndustry(c.name);
        return {
          id: c.id,
          slug: slugifyCategory(c.name),
          name: c.name,
          count: count || 0,
          status: c.status,
          industryId: (c as any).industryId ?? resolvedIndustryId ?? null,
        };
      })
    );

    return { rows, total };
  } catch {
    return { rows: [], total: 0 };
  }
}

export async function resolveIndustryName(categoryId?: string, industry?: string) {
  if (industry?.trim()) return industry.trim();
  if (!categoryId?.trim()) return undefined;

  const row = await prisma.industry.findFirst({
    where: {
      id: categoryId,
      status: "active",
    },
    select: { name: true },
  });

  return row?.name;
}

export async function getPublicSkills(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  industryId?: string;
  industry?: string;
}) {
  try {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 50;

    const skillFilters: SkillListFilters = {
      categoryId: options.categoryId ?? options.industryId,
      industryId: options.industryId,
      industry: options.industry,
    };

    const { categoryId, industryName } = await parseSkillListFilters(skillFilters);

    const { rows, total, degraded } = await listSkillsCompat(
      page,
      pageSize,
      options.search,
      skillFilters,
    );

    return {
      rows: rows.filter((row: any) => (row.status ?? "active") === "active"),
      total,
      degraded,
      industry: industryName ?? null,
      categoryId: categoryId ?? null,
    };
  } catch {
    return {
      rows: [],
      total: 0,
      degraded: true,
      industry: null,
      categoryId: options.categoryId ?? options.industryId ?? null,
    };
  }
}

export function getHomePageFallbackPayload() {
  return {
    cms: {
      ...DEFAULT_HOME_CONTENT,
      stats: DEFAULT_HOME_CONTENT.stats,
    },
    stats: {
      freelancers: 0,
      clients: 0,
      investors: 0,
      startup_ideas: 0,
      projects: 0,
    },
    categories: [],
    featuredSkills: ["React", "AI/ML", "Design", "Marketing", "Mobile"],
    degraded: true,
  };
}

export async function getHomePagePayload() {
  try {
    const [cms, stats, categoriesResult, skillsResult] = await Promise.all([
      getHomeCmsContent(),
      getPublicPlatformStats(),
      getPublicCategories({ pageSize: 10 }),
      getPublicSkills({ pageSize: 5 }),
    ]);

    const dynamicStats = cms.stats.map((item) => {
      const liveValue = stats[item.key as keyof typeof stats];
      return {
        ...item,
        value: liveValue ? formatStatValue(liveValue) : item.value,
        raw: liveValue ?? null,
      };
    });

    return {
      cms: {
        ...cms,
        stats: dynamicStats,
      },
      stats,
      categories: categoriesResult.rows,
      featuredSkills: skillsResult.rows.map((skill: any) => skill.name).filter(Boolean),
      degraded: Boolean(categoriesResult.rows.length === 0 && skillsResult.degraded),
    };
  } catch {
    return getHomePageFallbackPayload();
  }
}
