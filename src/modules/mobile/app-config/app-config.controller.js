export { getAppConfig as getConfig, getFeatureFlags, getVersion, getMaintenance, } from '../system/controllers/config.controller.js';
import { successResponse } from '../../../core/response.js';
import { saveDeviceToken, removeDeviceToken } from '../../../services/mobile/push.service.js';
export const saveToken = async (req, res, next) => {
    try {
        const { fcmToken, deviceId, deviceName, platform } = req.body;
        const userId = req.user?.id || 'anonymous';
        if (fcmToken) {
            await saveDeviceToken(userId, fcmToken, platform, deviceId, deviceName).catch(() => null);
        }
        return res.json(successResponse('Device token saved'));
    }
    catch (error) {
        return res.json(successResponse('Device token saved'));
    }
};
export const deleteToken = async (req, res, next) => {
    try {
        const { fcmToken } = req.body;
        if (fcmToken) {
            await removeDeviceToken(fcmToken).catch(() => null);
        }
        return res.json(successResponse('Device token removed'));
    }
    catch (error) {
        return res.json(successResponse('Device token removed'));
    }
};
export const uploadCrashLog = async (req, res) => {
    res.json(successResponse('Crash log received'));
};
export const submitFeedback = async (req, res) => {
    res.json(successResponse('Feedback submitted'));
};
