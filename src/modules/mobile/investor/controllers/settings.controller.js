import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getSettings = async (req, res, next) => {
    try {
        const prefs = await prisma.notificationPreference.findUnique({ where: { userId: req.user.id } });
        return res.json(successResponse('Settings retrieved', {
            language: 'en',
            privacy: 'public',
            visibility: true,
            notificationPreferences: prefs || { emailEnabled: true, pushEnabled: true, inAppEnabled: true }
        }));
    }
    catch (error) {
        next(error);
    }
};
export const updateSettings = async (req, res, next) => {
    try {
        return res.json(successResponse('Settings updated', req.body));
    }
    catch (error) {
        next(error);
    }
};
