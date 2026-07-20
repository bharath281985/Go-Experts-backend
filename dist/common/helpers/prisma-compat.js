import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";
export function isMissingColumnError(err, column) {
    const message = err instanceof Error ? err.message : String(err);
    const missingColumn = /Unknown column/i.test(message) ||
        /column .* does not exist/i.test(message) ||
        err?.code === "P2022";
    if (!missingColumn)
        return false;
    if (!column)
        return true;
    return message.toLowerCase().includes(column.toLowerCase());
}
/** Production schema lag (missing columns/tables/relations vs Prisma schema). */
export function isSchemaDriftError(err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err?.code;
    return (isMissingColumnError(err) ||
        code === "P2021" ||
        /does not exist in the current database/i.test(message) ||
        /Unknown table/i.test(message) ||
        /Table [`'"].*[`'"] doesn't exist/i.test(message));
}
/** Safe FreelancerProfile fields used by admin list (avoids optional JSON cols). */
export const FREELANCER_PROFILE_LIST_SELECT = {
    id: true,
    userId: true,
    industry: true,
    skills: true,
    hourlyRate: true,
    rating: true,
    experience: true,
    createdAt: true,
    updatedAt: true,
};
function emptyFreelancerRelations(user) {
    return {
        ...user,
        wallet: null,
        freelancerContracts: [],
        proposals: [],
        reviewsReceived: [],
    };
}
export async function resolveIndustryNameById(categoryId, industryName) {
    const trimmedName = industryName?.trim();
    if (trimmedName)
        return trimmedName;
    const id = categoryId?.trim();
    if (!id)
        return undefined;
    const row = await prisma.industry.findFirst({
        where: { id, status: "active" },
        select: { name: true },
    });
    return row?.name;
}
export async function parseSkillListFilters(filters) {
    const categoryId = filters?.categoryId?.trim() || filters?.industryId?.trim() || undefined;
    const industryName = await resolveIndustryNameById(categoryId, filters?.industry ?? filters?.category);
    return { categoryId, industryName };
}
export async function listSkillsCompat(page, pageSize, search, filters) {
    const { industryName: industry } = await parseSkillListFilters(filters);
    try {
        const where = {};
        if (search)
            where.OR = [{ name: { contains: search } }];
        if (industry)
            where.industry = industry;
        const total = await prisma.skill.count({ where });
        const rows = await prisma.skill.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { createdAt: "desc" },
        });
        return { rows, total, degraded: false };
    }
    catch (err) {
        if (!isMissingColumnError(err, "industry"))
            throw err;
        const offset = (page - 1) * pageSize;
        const searchClause = search ? Prisma.sql `AND name LIKE ${`%${search}%`}` : Prisma.empty;
        const rows = await prisma.$queryRaw `
      SELECT id, name, status, created_at as createdAt, updated_at as updatedAt
      FROM skills
      WHERE 1 = 1
      ${searchClause}
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;
        const countRows = search
            ? await prisma.$queryRaw `
          SELECT COUNT(*) as total FROM skills WHERE name LIKE ${`%${search}%`}
        `
            : await prisma.$queryRaw `
          SELECT COUNT(*) as total FROM skills
        `;
        const total = Number(countRows[0]?.total ?? rows.length);
        const mappedRows = rows.map(row => ({ ...row, industry: null }));
        const filteredRows = industry
            ? mappedRows.filter(row => {
                const seed = [
                    { name: "React", industry: "Technology" },
                    { name: "Node.js", industry: "Technology" },
                    { name: "TypeScript", industry: "Technology" },
                    { name: "Flutter", industry: "Technology" },
                    { name: "Python", industry: "Technology" },
                    { name: "Machine Learning", industry: "Technology" },
                    { name: "Data Science", industry: "Technology" },
                    { name: "DevOps", industry: "Technology" },
                    { name: "Blockchain", industry: "Finance" },
                    { name: "UI/UX Design", industry: "Marketing" },
                ].find(item => item.name.toLowerCase() === row.name.toLowerCase());
                return seed?.industry?.toLowerCase() === industry.toLowerCase();
            })
            : mappedRows;
        return {
            rows: filteredRows,
            total: industry ? filteredRows.length : total,
            degraded: true,
        };
    }
}
export async function listFreelancersCompat(options) {
    const { page, pageSize, search, orderBy, ascending, filters = {}, include, industryName } = options;
    const where = {
        ...filters,
        role: "freelancer",
        deletedAt: null,
    };
    if (search) {
        where.OR = [
            ...["fullName", "email", "country", "city", "bio"].map((col) => ({
                [col]: { contains: search },
            })),
            { freelancerProfile: { skills: { contains: search } } },
        ];
    }
    async function applyIndustrySkillsFallback(targetWhere) {
        if (!industryName)
            return;
        const profileFilter = targetWhere.freelancerProfile;
        if (profileFilter && typeof profileFilter === "object" && "industry" in profileFilter) {
            const nextProfile = { ...profileFilter };
            delete nextProfile.industry;
            targetWhere.freelancerProfile = Object.keys(nextProfile).length
                ? nextProfile
                : undefined;
        }
        const { rows: skillRows } = await listSkillsCompat(1, 200, undefined, { industry: industryName });
        const skillNames = skillRows.map((row) => row.name).filter(Boolean);
        if (skillNames.length === 0)
            return;
        const skillFilter = {
            OR: skillNames.map((name) => ({
                freelancerProfile: { skills: { contains: name } },
            })),
        };
        if (Array.isArray(targetWhere.AND)) {
            targetWhere.AND = [...targetWhere.AND, skillFilter];
        }
        else if (targetWhere.AND) {
            targetWhere.AND = [targetWhere.AND, skillFilter];
        }
        else {
            targetWhere.AND = [skillFilter];
        }
    }
    const orderByClause = { [orderBy]: ascending ? "asc" : "desc" };
    try {
        const total = await prisma.user.count({ where });
        const rows = await prisma.user.findMany({
            where,
            include: include,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: orderByClause,
        });
        return { rows, total, degraded: false };
    }
    catch (err) {
        if (!isSchemaDriftError(err))
            throw err;
        const fallbackWhere = { ...where };
        await applyIndustrySkillsFallback(fallbackWhere);
        // Attempt 2: profile-only (omit nested wallet/contracts + optional JSON columns).
        try {
            const total = await prisma.user.count({ where: fallbackWhere });
            const rows = await prisma.user.findMany({
                where: fallbackWhere,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: orderByClause,
                include: {
                    freelancerProfile: { select: FREELANCER_PROFILE_LIST_SELECT },
                },
            });
            return {
                rows: rows.map((user) => emptyFreelancerRelations(user)),
                total,
                degraded: true,
            };
        }
        catch (profileErr) {
            if (!isSchemaDriftError(profileErr))
                throw profileErr;
        }
        // Attempt 3: users + raw profile rows (legacy DB without newer columns).
        const total = await prisma.user.count({ where: fallbackWhere });
        const users = await prisma.user.findMany({
            where: fallbackWhere,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: orderByClause,
        });
        const userIds = users.map((user) => user.id);
        let profiles = [];
        if (userIds.length) {
            try {
                profiles = await prisma.$queryRaw `
          SELECT
            id,
            user_id as userId,
            industry,
            skills,
            hourly_rate as hourlyRate,
            rating,
            experience_level as experience
          FROM freelancer_profiles
          WHERE user_id IN (${Prisma.join(userIds)})
        `;
            }
            catch (rawErr) {
                if (!isMissingColumnError(rawErr, "industry"))
                    throw rawErr;
                profiles = await prisma.$queryRaw `
          SELECT
            id,
            user_id as userId,
            skills,
            hourly_rate as hourlyRate,
            rating,
            experience_level as experience
          FROM freelancer_profiles
          WHERE user_id IN (${Prisma.join(userIds)})
        `;
            }
        }
        const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));
        const rows = users.map((user) => emptyFreelancerRelations({
            ...user,
            freelancerProfile: profileMap.get(user.id) ?? null,
        }));
        return { rows, total, degraded: true };
    }
}
export async function getFreelancerByIdCompat(id, include) {
    try {
        return await prisma.user.findFirst({
            where: { id, role: "freelancer", deletedAt: null },
            include: include,
        });
    }
    catch (err) {
        if (!isSchemaDriftError(err))
            throw err;
        try {
            const row = await prisma.user.findFirst({
                where: { id, role: "freelancer", deletedAt: null },
                include: {
                    freelancerProfile: { select: FREELANCER_PROFILE_LIST_SELECT },
                },
            });
            if (!row)
                return null;
            return emptyFreelancerRelations(row);
        }
        catch (profileErr) {
            if (!isSchemaDriftError(profileErr))
                throw profileErr;
        }
        const user = await prisma.user.findFirst({
            where: { id, role: "freelancer", deletedAt: null },
        });
        if (!user)
            return null;
        let profiles = [];
        try {
            profiles = await prisma.$queryRaw `
        SELECT
          id,
          user_id as userId,
          industry,
          skills,
          hourly_rate as hourlyRate,
          rating,
          experience_level as experience
        FROM freelancer_profiles
        WHERE user_id = ${id}
        LIMIT 1
      `;
        }
        catch (rawErr) {
            if (!isMissingColumnError(rawErr, "industry"))
                throw rawErr;
            profiles = await prisma.$queryRaw `
        SELECT
          id,
          user_id as userId,
          skills,
          hourly_rate as hourlyRate,
          rating,
          experience_level as experience
        FROM freelancer_profiles
        WHERE user_id = ${id}
        LIMIT 1
      `;
        }
        return emptyFreelancerRelations({
            ...user,
            freelancerProfile: profiles[0] ?? null,
        });
    }
}
export async function upsertFreelancerProfileCompat(userId, profileData) {
    try {
        return await prisma.freelancerProfile.upsert({
            where: { userId },
            update: profileData,
            create: { userId, ...profileData },
        });
    }
    catch (err) {
        if (!isMissingColumnError(err, "industry"))
            throw err;
        const { industry, ...legacyProfile } = profileData;
        return prisma.freelancerProfile.upsert({
            where: { userId },
            update: legacyProfile,
            create: { userId, ...legacyProfile },
        });
    }
}
