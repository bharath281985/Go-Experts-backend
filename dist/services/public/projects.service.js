import { prisma } from "../../config/database.js";
import { resolveIndustryNameById } from "../../common/helpers/prisma-compat.js";
function formatBudget(value) {
    if (value >= 1000)
        return `\u20B9${Math.round(value / 1000)}k`;
    return `\u20B9${Math.round(value)}`;
}
function formatTimeline(timeline) {
    if (!timeline?.trim())
        return "4\u201310 weeks";
    return timeline;
}
export async function listPublicProjects(options) {
    try {
        const page = options?.page ?? 1;
        const pageSize = options?.pageSize ?? 6;
        const search = options?.search?.trim();
        const categoryName = (await resolveIndustryNameById(options?.categoryId, options?.category)) ??
            options?.category;
        // Only show projects whose owning client has NOT been soft-deleted
        const activeClients = await prisma.user.findMany({
            where: { deletedAt: null, role: "client" },
            select: { id: true },
        });
        const activeClientIds = activeClients.map((u) => u.id);
        const where = {
            deletedAt: null,
            status: { in: ["open", "approved", "active", "Published", "Open", "Approved", "Active"] },
            client: { in: activeClientIds },
        };
        if (categoryName)
            where.category = categoryName;
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { category: { contains: search } },
                { technology: { contains: search } },
            ];
        }
        const total = await prisma.project.count({ where });
        const rows = await prisma.project.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
            select: {
                id: true,
                title: true,
                budget: true,
                category: true,
                technology: true,
                timeline: true,
                status: true,
                description: true,
                experienceLevel: true,
                workMode: true,
                client: true,
                createdAt: true,
            },
        });
        const clientIds = [...new Set(rows.map((r) => r.client).filter(Boolean))];
        const clients = await prisma.user.findMany({
            where: { id: { in: clientIds }, deletedAt: null },
            select: { id: true, fullName: true, avatarUrl: true, country: true, isVerified: true, verified: true },
        });
        const clientMap = new Map(clients.map((c) => [c.id, {
                fullName: c.fullName,
                avatarUrl: c.avatarUrl,
                country: c.country,
                verified: c.isVerified || c.verified
            }]));
        const categoryIds = [...new Set(rows.map((r) => r.category).filter(Boolean))];
        const [industries, skillCategories] = await Promise.all([
            prisma.industry.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }),
            prisma.skillCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } }),
        ]);
        const categoryMap = new Map();
        industries.forEach((i) => categoryMap.set(i.id, i.name));
        skillCategories.forEach((sc) => categoryMap.set(sc.id, sc.name));
        const techIds = [...new Set(rows.flatMap((r) => r.technology ? r.technology.split(',').map(s => s.trim()) : []).filter(Boolean))];
        const skills = await prisma.skill.findMany({
            where: { id: { in: techIds } },
            select: { id: true, name: true }
        });
        const skillMap = new Map(skills.map((s) => [s.id, s.name]));
        return {
            rows: rows.map((row) => {
                const techs = row.technology ? row.technology.split(',').map(s => s.trim()).map(id => skillMap.get(id) || id) : [];
                return {
                    id: row.id,
                    title: row.title,
                    description: row.description || "",
                    budget: row.budget,
                    budgetLabel: `${formatBudget(row.budget * 0.8)} – ${formatBudget(row.budget * 1.2)}`,
                    category: categoryMap.get(row.category) || row.category || "General",
                    technology: techs,
                    timeline: formatTimeline(row.timeline),
                    status: row.status,
                    experienceLevel: row.experienceLevel || "Intermediate",
                    workMode: row.workMode || "Remote",
                    createdAt: row.createdAt,
                    clientInfo: clientMap.get(row.client) || { fullName: "Anonymous Client", avatarUrl: null, country: null, verified: false },
                };
            }),
            total,
        };
    }
    catch {
        return { rows: [], total: 0 };
    }
}
export async function getPostProjectStats() {
    try {
        const activeClients = await prisma.user.findMany({
            where: { deletedAt: null, role: "client" },
            select: { id: true },
        });
        const activeClientIds = activeClients.map((u) => u.id);
        const [projects, freelancers, proposals] = await Promise.all([
            prisma.project.count({ where: { deletedAt: null, client: { in: activeClientIds } } }),
            prisma.user.count({ where: { role: "freelancer", deletedAt: null } }),
            prisma.proposal.count(),
        ]);
        const avgProposals = projects > 0 ? Math.max(1, Math.round(proposals / projects)) : 12;
        const budgets = await prisma.project.aggregate({
            where: { deletedAt: null, client: { in: activeClientIds } },
            _min: { budget: true },
            _max: { budget: true },
        });
        const timelines = await prisma.project.findMany({
            where: { deletedAt: null, timeline: { not: null }, client: { in: activeClientIds } },
            select: { timeline: true },
            distinct: ["timeline"],
            take: 10,
        });
        return {
            projects,
            freelancers,
            proposals,
            avgProposals,
            budgetRange: {
                min: Math.floor(budgets._min.budget ?? 1000),
                max: Math.ceil(budgets._max.budget ?? 50000),
            },
            timelines: timelines
                .map((row) => row.timeline)
                .filter((value) => Boolean(value?.trim())),
        };
    }
    catch {
        return {
            projects: 0,
            freelancers: 0,
            proposals: 0,
            avgProposals: 12,
            budgetRange: { min: 1000, max: 50000 },
            timelines: ["< 1 month", "1–3 months", "3–6 months", "6+ months"],
        };
    }
}
export async function getPostProjectPagePayload() {
    const stats = await getPostProjectStats();
    const projects = await listPublicProjects({ pageSize: 6 });
    return {
        stats,
        exampleProjects: projects.rows,
        degraded: projects.rows.length === 0,
    };
}
