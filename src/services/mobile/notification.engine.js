"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationEngine = void 0;
const db_js_1 = require("../config/db.js");
const email_service_js_1 = require("./email.service.js");
const push_service_js_1 = require("./push.service.js");
class NotificationEngine {
    /**
     * Queue a notification for processing.
     */
    static async queueNotification(data) {
        if (data.channel === 'all') {
            await this.createQueueItem(data.userId, data.type, data.title, data.message, 'in_app', data.payload, data.scheduledAt);
            await this.createQueueItem(data.userId, data.type, data.title, data.message, 'email', data.payload, data.scheduledAt);
            await this.createQueueItem(data.userId, data.type, data.title, data.message, 'push', data.payload, data.scheduledAt);
        }
        else {
            await this.createQueueItem(data.userId, data.type, data.title, data.message, data.channel, data.payload, data.scheduledAt);
        }
    }
    static async createQueueItem(userId, type, title, message, channel, payload, scheduledAt) {
        // Check preferences first
        const prefs = await db_js_1.prisma.notificationPreference.findUnique({ where: { userId } });
        if (prefs) {
            if (channel === 'email' && !prefs.emailEnabled)
                return;
            if (channel === 'push' && !prefs.pushEnabled)
                return;
            if (channel === 'in_app' && !prefs.inAppEnabled)
                return;
        }
        // Create Notification first
        const notification = await db_js_1.prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                channel,
                status: 'queued',
                scheduledAt,
                metadata: payload ? JSON.stringify(payload) : undefined
            }
        });
        // Create Queue Item
        await db_js_1.prisma.notificationQueue.create({
            data: {
                notificationId: notification.id,
                status: 'pending',
                scheduledAt
            }
        });
    }
    /**
     * Process pending items in the queue
     */
    static async processQueue() {
        const items = await db_js_1.prisma.notificationQueue.findMany({
            where: {
                status: 'pending',
                OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }]
            },
            include: { notification: true },
            take: 50
        });
        for (const item of items) {
            await this.processItem(item);
        }
    }
    static async processItem(item) {
        try {
            await db_js_1.prisma.notificationQueue.update({ where: { id: item.id }, data: { status: 'processing', attempts: item.attempts + 1 } });
            let success = false;
            const user = item.notification.userId ? await db_js_1.prisma.user.findUnique({ where: { id: item.notification.userId } }) : null;
            if (!user) {
                // Some notifications might be broadcast, but skipping for now
                throw new Error('User not found');
            }
            if (item.notification.channel === 'in_app') {
                await db_js_1.prisma.notification.update({
                    where: { id: item.notification.id },
                    data: { status: 'delivered' }
                });
                success = true;
            }
            else if (item.notification.channel === 'email') {
                success = await (0, email_service_js_1.sendEmail)(user.email, item.notification.title, item.notification.message);
            }
            else if (item.notification.channel === 'push') {
                let dataPayload;
                try {
                    dataPayload = item.notification.metadata ? JSON.parse(item.notification.metadata) : undefined;
                }
                catch (e) { }
                success = await (0, push_service_js_1.sendPushNotification)(user.id, item.notification.title, item.notification.message, dataPayload);
            }
            if (success) {
                await db_js_1.prisma.notificationQueue.update({ where: { id: item.id }, data: { status: 'completed' } });
                await db_js_1.prisma.notification.update({ where: { id: item.notification.id }, data: { status: 'delivered', sentAt: new Date() } });
                await this.logNotification(item.notification.id, user.id, item.notification.channel, 'delivered');
            }
            else {
                await this.handleFailure(item, new Error('Delivery failed'));
            }
        }
        catch (error) {
            await this.handleFailure(item, error);
        }
    }
    static async handleFailure(item, error) {
        const status = item.attempts >= item.maxAttempts - 1 ? 'failed' : 'pending';
        await db_js_1.prisma.notificationQueue.update({
            where: { id: item.id },
            data: { status, error: error.message }
        });
        await db_js_1.prisma.notificationDeliveryAttempt.create({
            data: {
                queueId: item.id,
                notificationId: item.notification.id,
                channel: item.notification.channel,
                status: 'failed',
                errorMessage: error.message,
                attemptNumber: item.attempts + 1
            }
        });
        if (status === 'failed') {
            await db_js_1.prisma.notification.update({ where: { id: item.notification.id }, data: { status: 'failed', failedAt: new Date() } });
            if (item.notification.userId) {
                await this.logNotification(item.notification.id, item.notification.userId, item.notification.channel, 'failed');
            }
        }
    }
    static async logNotification(notificationId, userId, channel, status) {
        await db_js_1.prisma.notificationLog.create({
            data: { notificationId, userId, channel, status }
        });
    }
    /**
     * Retry failed items
     */
    static async retryFailed() {
        await db_js_1.prisma.notificationQueue.updateMany({
            where: { status: 'failed', attempts: { lt: 5 } },
            data: { status: 'pending' }
        });
    }
}
exports.NotificationEngine = NotificationEngine;
