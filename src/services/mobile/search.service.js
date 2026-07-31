"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSearch = exports.trackKeyword = void 0;
const db_js_1 = require("../config/db.js");
const trackKeyword = async (_keyword) => {
    // Search keyword analytics table is not in the current schema.
};
exports.trackKeyword = trackKeyword;
const globalSearch = async (userId, input) => {
    const { query, type, page = 1, limit = 10, city, category, industry, stage } = input;
    const skip = (page - 1) * limit;
    const q = (query || '').trim();
    const results = {};
    const queryMode = { mode: 'insensitive' };
    const all = !type || type === 'all';
    if (all || type === 'freelancer') {
        results.freelancers = await db_js_1.prisma.user.findMany({
            where: {
                role: 'freelancer',
                status: 'active',
                deletedAt: null,
                OR: [
                    { fullName: { contains: q, ...queryMode } },
                    { city: { contains: q, ...queryMode } },
                    { bio: { contains: q, ...queryMode } }
                ],
                ...(city ? { city: { contains: city, ...queryMode } } : {})
            },
            select: { id: true, fullName: true, avatarUrl: true, city: true, bio: true, freelancerProfile: true },
            skip, take: limit
        });
    }
    if (all || type === 'client') {
        results.clients = await db_js_1.prisma.user.findMany({
            where: {
                role: 'client',
                status: 'active',
                deletedAt: null,
                OR: [{ fullName: { contains: q, ...queryMode } }, { city: { contains: q, ...queryMode } }],
                ...(city ? { city: { contains: city, ...queryMode } } : {})
            },
            select: { id: true, fullName: true, avatarUrl: true, city: true, clientProfile: true },
            skip, take: limit
        });
    }
    if (all || type === 'investor') {
        results.investors = await db_js_1.prisma.user.findMany({
            where: {
                role: 'investor',
                status: 'active',
                deletedAt: null,
                OR: [{ fullName: { contains: q, ...queryMode } }, { city: { contains: q, ...queryMode } }]
            },
            select: { id: true, fullName: true, avatarUrl: true, city: true, investorProfile: true },
            skip, take: limit
        });
    }
    if (all || type === 'founder' || type === 'startup') {
        results.startups = await db_js_1.prisma.user.findMany({
            where: {
                role: 'founder',
                status: 'active',
                deletedAt: null,
                OR: [
                    { fullName: { contains: q, ...queryMode } },
                    { founderProfile: { startupName: { contains: q, ...queryMode } } },
                    { founderProfile: { industry: { contains: q, ...queryMode } } }
                ],
                ...(industry ? { founderProfile: { industry: { contains: industry, ...queryMode } } } : {}),
                ...(stage ? { founderProfile: { stage: { contains: stage, ...queryMode } } } : {})
            },
            select: { id: true, fullName: true, avatarUrl: true, city: true, founderProfile: true },
            skip, take: limit
        });
    }
    if (all || type === 'project') {
        results.projects = await db_js_1.prisma.project.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { title: { contains: q, ...queryMode } },
                    { category: { contains: q, ...queryMode } },
                    { technology: { contains: q, ...queryMode } }
                ],
                ...(category ? { category: { contains: category, ...queryMode } } : {}),
                status: input.status || undefined
            },
            skip, take: limit
        });
    }
    if (all || type === 'file') {
        if (userId) {
            results.files = await db_js_1.prisma.mediaFile.findMany({
                where: {
                    uploadedBy: userId,
                    deletedAt: null,
                    status: 'active',
                    OR: [
                        { originalName: { contains: q, ...queryMode } },
                        { filetype: { contains: q, ...queryMode } }
                    ]
                },
                skip, take: limit
            });
        }
    }
    if (all || type === 'blog') {
        results.blogs = await db_js_1.prisma.blog.findMany({
            where: {
                status: 'active',
                OR: [
                    { title: { contains: q, ...queryMode } },
                    { category: { contains: q, ...queryMode } }
                ]
            },
            select: { id: true, title: true, category: true, author: true, createdAt: true },
            skip, take: limit
        });
    }
    if (all || type === 'faq') {
        results.faqs = await db_js_1.prisma.faq.findMany({
            where: {
                OR: [
                    { question: { contains: q, ...queryMode } },
                    { answer: { contains: q, ...queryMode } }
                ]
            },
            skip, take: limit
        });
    }
    if ((all || type === 'ticket') && userId) {
        results.tickets = await db_js_1.prisma.supportTicket.findMany({
            where: {
                user: userId,
                OR: [
                    { subject: { contains: q, ...queryMode } },
                    { category: { contains: q, ...queryMode } }
                ]
            },
            select: { id: true, subject: true, status: true, priority: true, createdAt: true },
            skip, take: limit
        });
    }
    if (q)
        await (0, exports.trackKeyword)(q);
    return results;
};
exports.globalSearch = globalSearch;
