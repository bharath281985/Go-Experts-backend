import { prisma } from '../../config/database.js';

export type PaginationInput = {
  page?: number;
  limit?: number;
  cursor?: string;
};

const DEFAULT_SELECT_USER = {
  id: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  status: true,
  isVerified: true,
  city: true
};

export const getUsersByRole = async (role: string, { page = 1, limit = 20 }: PaginationInput) => {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { role, status: 'active', deletedAt: null },
      select: DEFAULT_SELECT_USER,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.user.count({ where: { role, status: 'active', deletedAt: null } })
  ]);
  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getConversationsOptimized = async (userId: string, { page = 1, limit = 20 }: PaginationInput) => {
  const skip = (page - 1) * limit;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return prisma.conversation.findMany({
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

export const getProjectsPaginated = async (where: any, { page = 1, limit = 20 }: PaginationInput) => {
  const skip = (page - 1) * limit;
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: { ...where, deletedAt: null },
      select: {
        id: true, title: true, category: true, status: true, budget: true,
        timeline: true, technology: true, client: true, createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.project.count({ where: { ...where, deletedAt: null } })
  ]);
  return { projects, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getNotificationsBatch = async (userId: string, { page = 1, limit = 20 }: PaginationInput) => {
  const skip = (page - 1) * limit;
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      select: { id: true, title: true, message: true, type: true, status: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);
  return { notifications, unreadCount, page, limit };
};

export const getActivityFeed = async (_userId: string, { page = 1, limit = 20 }: PaginationInput) => {
  return [];
};
