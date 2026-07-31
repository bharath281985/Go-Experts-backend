import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';
export const getQueue = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;
        const [queue, total] = await Promise.all([
            prisma.notificationQueue.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.notificationQueue.count()
        ]);
        return res.json(successResponse('Notification queue retrieved', queue, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const retryFailed = async (req, res, next) => {
    try {
        await NotificationEngine.retryFailed();
        return res.json(successResponse('Failed notifications queued for retry'));
    }
    catch (error) {
        next(error);
    }
};
