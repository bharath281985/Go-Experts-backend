"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = exports.removeDeviceToken = exports.saveDeviceToken = void 0;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const db_js_1 = require("../config/db.js");
// Initialize Firebase Admin safely
const initFirebaseAdmin = () => {
    try {
        if ((0, app_1.getApps)().length === 0) {
            if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                (0, app_1.initializeApp)({
                    credential: (0, app_1.cert)(serviceAccount)
                });
                console.log('Firebase Admin initialized successfully');
            }
            else {
                console.warn('Firebase Admin NOT initialized: Missing FIREBASE_SERVICE_ACCOUNT_KEY');
            }
        }
    }
    catch (error) {
        console.error('Failed to initialize Firebase Admin:', error);
    }
};
initFirebaseAdmin();
const saveDeviceToken = async (userId, token, platform, deviceId, deviceName) => {
    try {
        await db_js_1.prisma.deviceToken.upsert({
            where: { token },
            update: { userId, platform: platform || 'unknown', updatedAt: new Date() },
            create: { userId, token, platform: platform || 'unknown' },
        });
    }
    catch (error) {
        console.error('Failed to save device token:', error);
    }
};
exports.saveDeviceToken = saveDeviceToken;
const removeDeviceToken = async (token) => {
    try {
        await db_js_1.prisma.deviceToken.delete({
            where: { token }
        });
    }
    catch (error) {
        console.error('Failed to remove device token:', error);
    }
};
exports.removeDeviceToken = removeDeviceToken;
const sendPushNotification = async (userId, title, body, data) => {
    if ((0, app_1.getApps)().length === 0) {
        console.log(`[DEV MODE] Push skipped for User ${userId}. Title: ${title}`);
        return true; // Simulate success
    }
    try {
        const tokens = await db_js_1.prisma.deviceToken.findMany({ where: { userId } });
        if (tokens.length === 0) {
            console.log(`No device tokens found for User ${userId}`);
            return false; // Can't deliver, maybe retry later
        }
        const messages = tokens.map(t => ({
            token: t.token,
            notification: { title, body },
            data: data || {}
        }));
        const response = await (0, messaging_1.getMessaging)().sendEach(messages);
        console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);
        return response.successCount > 0;
    }
    catch (error) {
        console.error('Failed to send push notification:', error);
        return false;
    }
};
exports.sendPushNotification = sendPushNotification;
