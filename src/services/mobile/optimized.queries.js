"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityFeed = exports.getNotificationsBatch = exports.getProjectsPaginated = exports.getConversationsOptimized = exports.getUsersByRole = void 0;
const db_js_1 = require("../config/db.js");
const DEFAULT_SELECT_USER = {
    id: true,
    fullName: true,
    avatarUrl: true,
    role: true,
    status: true,
    isVerified: true,
    city: true
};
const getUsersByRole = async (role, { page = 1, limit = 20 }) => {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
        db_js_1.prisma.user.findMany({
            where: { role, status: 'active', deletedAt: null },
            select: DEFAULT_SELECT_USER,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        db_js_1.prisma.user.count({ where: { role, status: 'active', deletedAt: null } })
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
};
exports.getUsersByRole = getUsersByRole;
const getConversationsOptimized = async (userId, { page = 1, limit = 20 }) => {
    const skip = (page - 1) * limit;
    const user = await db_js_1.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    return db_js_1.prisma.conversation.findMany({
        where: {
            status: 'active',
            deletedAt: null,
            role: user?.role || undefined
        },
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { id: true, text: true, createdAt: true, from: true }
            }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
    });
};
exports.getConversationsOptimized = getConversationsOptimized;
const getProjectsPaginated = async (where, { page = 1, limit = 20 }) => {
    const skip = (page - 1) * limit;
    const [projects, total] = await Promise.all([
        db_js_1.prisma.project.findMany({
            where: { ...where, deletedAt: null },
            select: {
                id: true, title: true, category: true, status: true, budget: true,
                timeline: true, technology: true, client: true, createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        db_js_1.prisma.project.count({ where: { ...where, deletedAt: null } })
    ]);
    return { projects, total, page, limit, totalPages: Math.ceil(total / limit) };
};
exports.getProjectsPaginated = getProjectsPaginated;
const getNotificationsBatch = async (userId, { page = 1, limit = 20 }) => {
    const skip = (page - 1) * limit;
    const [notifications, unreadCount] = await Promise.all([
        db_js_1.prisma.notification.findMany({
            where: { userId },
            select: { id: true, title: true, message: true, type: true, status: true, metadata: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        db_js_1.prisma.notification.count({ where: { userId, readAt: null } })
    ]);
    return { notifications, unreadCount, page, limit };
};
exports.getNotificationsBatch = getNotificationsBatch;
const getActivityFeed = async (_userId, { page = 1, limit = 20 }) => {
    return [];
};
exports.getActivityFeed = getActivityFeed;
