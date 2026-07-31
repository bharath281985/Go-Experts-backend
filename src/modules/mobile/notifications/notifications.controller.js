import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
export const getNotifications = async (req, res, next) => {
    try {
        return res.json(successResponse('Notifications retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const getUnreadCount = async (req, res, next) => {
    try {
        const count = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
        return res.json(successResponse('Unread count retrieved', { unreadCount: count }));
    }
    catch (error) {
        next(error);
    }
};
export const markRead = async (req, res, next) => {
    try {
        await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { readAt: new Date(), status: 'read' } });
        return res.json(successResponse('Notification marked read'));
    }
    catch (error) {
        next(error);
    }
};
export const markAllRead = async (req, res, next) => {
    try {
        await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date(), status: 'read' } });
        return res.json(successResponse('All notifications marked read'));
    }
    catch (error) {
        next(error);
    }
};
export const deleteNotification = async (req, res, next) => {
    try {
        await prisma.notification.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
        return res.json(successResponse('Notification deleted'));
    }
    catch (error) {
        next(error);
    }
};
export const getPreferences = async (req, res, next) => {
    try {
        const defaultPrefs = {
            emailEnabled: true, pushEnabled: true, inAppEnabled: true,
            projectUpdates: true, paymentUpdates: true, subscriptionUpdates: true,
            securityAlerts: true, marketingEmails: false
        };
        return res.json(successResponse('Preferences retrieved', defaultPrefs));
    }
    catch (error) {
        next(error);
    }
};
export const updatePreferences = async (req, res, next) => {
    try {
        return res.json(successResponse('Preferences updated', req.body));
    }
    catch (error) {
        next(error);
    }
};
