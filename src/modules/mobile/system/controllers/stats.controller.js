import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getStorageUsage = async (req, res, next) => {
    try {
        const aggregate = await prisma.mediaFile.aggregate({
            _sum: { filesize: true },
            _count: { id: true },
            where: { deletedAt: null, status: 'active' }
        });
        const byType = await prisma.mediaFile.groupBy({
            by: ['filetype'],
            _sum: { filesize: true },
            where: { deletedAt: null, status: 'active' }
        });
        const categoryMap = {};
        for (const group of byType) {
            categoryMap[group.filetype] = group._sum.filesize || 0;
        }
        return res.json(successResponse('Global Storage Statistics', {
            totalBytes: aggregate._sum.filesize || 0,
            totalFiles: aggregate._count.id || 0,
            byCategory: categoryMap
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getDashboardCounters = async (req, res, next) => {
    try {
        const [users, projects, meetings, messages, invoices, subscriptions] = await Promise.all([
            prisma.user.count(),
            prisma.project.count({ where: { deletedAt: null } }),
            prisma.meeting.count(),
            prisma.message.count(),
            prisma.invoice.count(),
            prisma.subscription.count()
        ]);
        return res.json(successResponse('Dashboard Counters', {
            users,
            projects,
            meetings,
            messages,
            invoices,
            subscriptions
        }));
    }
    catch (error) {
        next(error);
    }
};
