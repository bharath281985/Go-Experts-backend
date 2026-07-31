"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobEngine = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_js_1 = require("../config/db.js");
class JobEngine {
    /**
     * Initializes all background cron jobs.
     * Note: In a heavily scaled multi-instance environment, you should use
     * a distributed lock (e.g., Redis) or a dedicated worker queue (BullMQ/Agenda).
     * Since this is a self-contained Express app, node-cron is sufficient for simple background tasks.
     */
    static init() {
        console.log('🕒 Initializing Background Job Engine...');
        // 1. Subscription Expiry Reminder (Runs every day at 8:00 AM)
        node_cron_1.default.schedule('0 8 * * *', async () => {
            console.log('[JOB] Running Subscription Expiry Reminder');
            try {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                // Find subscriptions expiring in exactly 7 days
                // Implementation would query Prisma and push to Email/Notification Queue
                // e.g., prisma.subscription.findMany({ where: { endDate: { lte: nextWeek } } })
            }
            catch (error) {
                console.error('[JOB ERROR] Subscription Expiry Reminder:', error);
            }
        });
        // 2. Cleanup Expired Sessions & Tokens (Runs every day at 2:00 AM)
        node_cron_1.default.schedule('0 2 * * *', async () => {
            console.log('[JOB] Running Cleanup Expired Device Tokens');
            try {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                await db_js_1.prisma.deviceToken.deleteMany({
                    where: { updatedAt: { lt: thirtyDaysAgo } }
                });
            }
            catch (error) {
                console.error('[JOB ERROR] Cleanup Expired Device Tokens:', error);
            }
        });
        // 3. Notification Retry (Runs every 15 minutes)
        node_cron_1.default.schedule('*/15 * * * *', async () => {
            console.log('[JOB] Running Notification Retry');
            try {
                // Attempt to process notificationQueue items that failed (status: failed, retries < 3)
                // prisma.notificationQueue.findMany({ where: { status: 'failed' } })
            }
            catch (error) {
                console.error('[JOB ERROR] Notification Retry:', error);
            }
        });
        // 4. Analytics Cache Generation (Runs every hour)
        node_cron_1.default.schedule('0 * * * *', async () => {
            console.log('[JOB] Running Analytics Cache Generation');
            try {
                // Here you would run heavy SQL aggregations and store them in `Setting` or a dedicated cache table
                const totalUsers = await db_js_1.prisma.user.count();
                await db_js_1.prisma.setting.upsert({
                    where: { key: 'cache:total_users' },
                    update: { value: totalUsers.toString() },
                    create: { key: 'cache:total_users', value: totalUsers.toString(), category: 'analytics' }
                });
            }
            catch (error) {
                console.error('[JOB ERROR] Analytics Cache Generation:', error);
            }
        });
        console.log('🕒 Background Job Engine Initialized');
    }
}
exports.JobEngine = JobEngine;
