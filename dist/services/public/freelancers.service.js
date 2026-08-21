import { prisma } from "../../config/database.js";
import { listFreelancersCompat, } from "../../common/helpers/prisma-compat.js";
import { getPublicCategories } from "./home.service.js";
function resolveSort(body) {
    const orderBy = body.orderBy || "createdAt";
    const ascending = body.ascending ?? false;
    if (orderBy === "rating") {
        return { orderBy: "freelancerProfile", ascending: !ascending, profileField: "rating" };
    }
    if (orderBy === "price" || orderBy === "hourlyRate") {
        return { orderBy: "freelancerProfile", ascending, profileField: "hourlyRate" };
    }
    return { orderBy, ascending, profileField: null };
}
export async function listPublicFreelancers(body) {
    const mergedFilters = {};
    if (body.experience?.length) {
        mergedFilters.freelancerProfile = {
            experience: { in: body.experience },
        };
    }
    if (body.rateMin !== undefined || body.rateMax !== undefined) {
        const hourlyRate = {};
        if (body.rateMin !== undefined)
            hourlyRate.gte = body.rateMin;
        if (body.rateMax !== undefined)
            hourlyRate.lte = body.rateMax;
        mergedFilters.freelancerProfile = {
            ...mergedFilters.freelancerProfile,
            hourlyRate,
        };
    }
    const categoryId = body.categoryId ?? body.industryId;
    let industryName;
    if (categoryId) {
        const industry = await prisma.industry.findFirst({
            where: { id: categoryId, status: "active" },
            select: { name: true },
        });
        if (industry) {
            industryName = industry.name;
            mergedFilters.freelancerProfile = {
                ...mergedFilters.freelancerProfile,
                industry: industry.name,
            };
        }
    }
    const sort = resolveSort(body);
    let orderBy = sort.orderBy;
    let ascending = sort.ascending;
    if (sort.profileField === "rating") {
        orderBy = "createdAt";
        ascending = false;
    }
    else if (sort.profileField === "hourlyRate") {
        orderBy = "createdAt";
        ascending = body.ascending ?? true;
    }
    const { rows, total, degraded } = await listFreelancersCompat({
        page: body.page ?? 1,
        pageSize: body.pageSize ?? 50,
        search: body.search || body.skills?.[0],
        orderBy,
        ascending,
        filters: mergedFilters,
        include: { freelancerProfile: true },
        industryName,
    });
    let sortedRows = rows;
    if (sort.profileField === "rating") {
        sortedRows = [...rows].sort((a, b) => {
            const left = Number(a.freelancerProfile?.rating ?? 0);
            const right = Number(b.freelancerProfile?.rating ?? 0);
            return ascending ? left - right : right - left;
        });
    }
    else if (sort.profileField === "hourlyRate") {
        sortedRows = [...rows].sort((a, b) => {
            const left = Number(a.freelancerProfile?.hourlyRate ?? 0);
            const right = Number(b.freelancerProfile?.hourlyRate ?? 0);
            return ascending ? left - right : right - left;
        });
    }
    sortedRows = sortedRows.map((row) => {
        if (row) {
            delete row.password;
        }
        return row;
    });
    return { rows: sortedRows, total, degraded, categoryId: categoryId ?? null };
}
export async function getFreelancerRateRange() {
    try {
        const result = await prisma.freelancerProfile.aggregate({
            _min: { hourlyRate: true },
            _max: { hourlyRate: true },
        });
        const min = Math.floor(result._min.hourlyRate ?? 0);
        const max = Math.ceil(result._max.hourlyRate ?? 0);
        return {
            min: Number.isFinite(min) ? min : 0,
            max: Number.isFinite(max) && max > 0 ? max : 500,
        };
    }
    catch {
        return { min: 0, max: 500 };
    }
}
async function getDistinctProfileExperience() {
    try {
        const profiles = await prisma.freelancerProfile.findMany({
            where: { experience: { not: null } },
            select: { experience: true },
            distinct: ["experience"],
            take: 50,
        });
        return profiles
            .map((profile) => profile.experience)
            .filter((value) => Boolean(value?.trim()));
    }
    catch {
        return [];
    }
}
export async function getPublicFreelancerFilters() {
    const [categoriesResult, experienceResult, rateRange, profileExperience] = await Promise.all([
        getPublicCategories({ pageSize: 100 }),
        listPublicExperienceLevels(50),
        getFreelancerRateRange(),
        getDistinctProfileExperience(),
    ]);
    const experienceNames = new Set();
    for (const row of experienceResult.rows) {
        if (row.name)
            experienceNames.add(row.name);
    }
    for (const name of profileExperience) {
        experienceNames.add(name);
    }
    return {
        categories: categoriesResult.rows,
        experienceLevels: Array.from(experienceNames)
            .sort((left, right) => left.localeCompare(right))
            .map((name, index) => ({
            id: `experience-${index}`,
            name,
        })),
        rateRange,
    };
}
export async function listPublicExperienceLevels(pageSize = 50) {
    const dedupeRows = (rows) => {
        const seen = new Set();
        return rows.filter((row) => {
            const key = String(row.value || row.label || row.name || "").trim().toLowerCase();
            if (!key || seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    };
    try {
        const masterRows = await prisma.masterOption?.findMany({
            where: { type: "experience_level", status: "active" },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            take: pageSize,
            select: { id: true, label: true, value: true, status: true },
        }).catch(() => []);
        if (Array.isArray(masterRows) && masterRows.length > 0) {
            const rows = dedupeRows(masterRows.map((row) => ({
                id: row.id,
                name: row.label,
                label: row.label,
                value: row.value,
                status: row.status,
            })));
            return { rows, total: rows.length };
        }
        const legacyRows = dedupeRows(await prisma.experienceLevel.findMany({
            where: { status: "active" },
            orderBy: { createdAt: "asc" },
            take: pageSize,
        }));
        return { rows: legacyRows, total: legacyRows.length };
    }
    catch {
        return { rows: [], total: 0 };
    }
}
