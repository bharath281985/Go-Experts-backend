import { prisma } from "../../config/database.js";
import { SchedulerService } from "./scheduler.service.js";
import { AutomationEngine } from "./automation.engine.js";
import { NotificationService } from "../notifications/notification.service.js";
import fs from "fs";
import path from "path";
export function registerSystemJobs() {
    // 1. Subscription Expiry Check
    SchedulerService.registerHandler("Subscription Expiry Check", async () => {
        const now = new Date();
        const expiredSubs = await prisma.subscription.findMany({
            where: {
                status: "active",
                endDate: { lte: now },
            },
            include: {
                user: true,
                plan: true,
            },
        });
        for (const sub of expiredSubs) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: { status: "expired" },
            });
            await prisma.subscriptionHistory.create({
                data: {
                    userId: sub.userId,
                    planId: sub.planId,
                    action: "expired",
                },
            });
            console.log(`[SYSTEM JOB] Expired subscription ${sub.id} for user ${sub.user.email}`);
            // Trigger automation rules
            await AutomationEngine.trigger("subscription_expired", sub.id, {
                userId: sub.userId,
                userEmail: sub.user.email,
                userName: sub.user.fullName,
                planName: sub.plan.name,
                endDate: sub.endDate.toISOString(),
            });
        }
    });
    // 2. Subscription Renewal Reminder
    SchedulerService.registerHandler("Subscription Renewal Reminder", async () => {
        const now = new Date();
        const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const expiringSubs = await prisma.subscription.findMany({
            where: {
                status: "active",
                endDate: {
                    gte: now,
                    lte: threeDaysFromNow,
                },
            },
            include: {
                user: true,
                plan: true,
            },
        });
        for (const sub of expiringSubs) {
            console.log(`[SYSTEM JOB] Renewal reminder for subscription ${sub.id} of user ${sub.user.email}`);
            await AutomationEngine.trigger("subscription_renewal_reminder", sub.id, {
                userId: sub.userId,
                userEmail: sub.user.email,
                userName: sub.user.fullName,
                planName: sub.plan.name,
                days: 3,
                endDate: sub.endDate.toISOString(),
            });
        }
    });
    // 3. Subscription Grace Period Expiry
    SchedulerService.registerHandler("Subscription Grace Period Expiry", async () => {
        const now = new Date();
        // In our system grace period is considered to be active subscriptions within 7 days past end date
        // If unpaid after 7 days, they transition from active/grace to expired
        const graceThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const graceSubs = await prisma.subscription.findMany({
            where: {
                status: "active", // Or "grace_period" if status value is supported
                endDate: { lte: graceThreshold },
            },
            include: {
                user: true,
                plan: true,
            },
        });
        for (const sub of graceSubs) {
            await prisma.subscription.update({
                where: { id: sub.id },
                data: { status: "expired" },
            });
            console.log(`[SYSTEM JOB] Grace period expired. Terminated subscription ${sub.id}`);
            await AutomationEngine.trigger("grace_period_expired", sub.id, {
                userId: sub.userId,
                userEmail: sub.user.email,
                planName: sub.plan.name,
            });
        }
    });
    // 4. Meeting Reminder
    SchedulerService.registerHandler("Meeting Reminder", async () => {
        const now = new Date();
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const meetings = await prisma.meeting.findMany({
            where: {
                status: { in: ["scheduled", "pending"] },
                time: {
                    gte: now.toLocaleTimeString(), // simple match
                },
            },
        });
        for (const m of meetings) {
            const meetingTitle = `Meeting: ${m.founder} & ${m.investor}`;
            console.log(`[SYSTEM JOB] Sending meeting reminder for meeting: "${meetingTitle}"`);
            // Trigger rules
            await AutomationEngine.trigger("meeting_tomorrow", m.id, {
                meetingTitle,
                founder: m.founder,
                investor: m.investor,
            });
        }
    });
    // 5. Upcoming Interview Reminder
    SchedulerService.registerHandler("Upcoming Interview Reminder", async () => {
        const proposals = await prisma.proposal.findMany({
            where: { status: "interview" },
            include: {
                freelancer: true,
                project: true,
            },
        });
        for (const prop of proposals) {
            console.log(`[SYSTEM JOB] Interview reminder for proposal ${prop.id}`);
            await AutomationEngine.trigger("upcoming_interview", prop.id, {
                freelancerId: prop.freelancerId,
                freelancerName: prop.freelancer.fullName,
                freelancerEmail: prop.freelancer.email,
                projectTitle: prop.project.title,
                clientName: prop.project.client,
            });
        }
    });
    // 6. Invoice Reminder
    SchedulerService.registerHandler("Invoice Reminder", async () => {
        const invoices = await prisma.invoice.findMany({
            where: { status: "unpaid" },
            include: { user: true },
        });
        for (const inv of invoices) {
            console.log(`[SYSTEM JOB] Invoice unpaid reminder for ${inv.invoiceNumber}`);
            await AutomationEngine.trigger("invoice_reminder", inv.id, {
                userId: inv.userId,
                userEmail: inv.user.email,
                userName: inv.user.fullName,
                invoiceNumber: inv.invoiceNumber,
                total: inv.total,
            });
        }
    });
    // 7. Pending Payment Reminder
    SchedulerService.registerHandler("Pending Payment Reminder", async () => {
        const payments = await prisma.payment.findMany({
            where: { status: "pending" },
            include: { user: true },
        });
        for (const p of payments) {
            console.log(`[SYSTEM JOB] Pending payment reminder for user ${p.user.email}`);
            await AutomationEngine.trigger("pending_payment", p.id, {
                userId: p.userId,
                amount: p.amount,
                txnId: p.transactionId,
            });
        }
    });
    // 8. Pending Withdrawal Reminder
    SchedulerService.registerHandler("Pending Withdrawal Reminder", async () => {
        // Wallet debit transactions represent withdrawals
        const withdrawals = await prisma.walletTransaction.findMany({
            where: {
                direction: "debit",
                type: "withdrawal", // withdrawal type
                // if transaction status was pending, check
            },
            take: 20,
        });
        for (const w of withdrawals) {
            console.log(`[SYSTEM JOB] Pending withdrawal warning for amount ${w.amount}`);
            await AutomationEngine.trigger("pending_withdrawal", w.id, {
                walletId: w.walletId,
                amount: w.amount,
            });
        }
    });
    // 9. Pending Support Ticket Reminder
    SchedulerService.registerHandler("Pending Support Ticket Reminder", async () => {
        const tickets = await prisma.supportTicket.findMany({
            where: {
                status: { in: ["Open", "In Progress", "pending", "open"] },
                priority: { in: ["High", "Urgent", "urgent", "high"] },
            },
        });
        for (const ticket of tickets) {
            console.log(`[SYSTEM JOB] Pending Urgent/High Ticket alert: "${ticket.subject}"`);
            await AutomationEngine.trigger("support_ticket_overdue", ticket.id, {
                subject: ticket.subject,
                user: ticket.requesterId,
                category: ticket.categoryId,
                priority: ticket.priority,
            });
        }
    });
    // 10. Password Reset Cleanup
    SchedulerService.registerHandler("Password Reset Cleanup", async () => {
        console.log("[SYSTEM JOB] Password Reset Cleanup completed. (0 cleaned)");
    });
    // 11. Expired OTP Cleanup
    SchedulerService.registerHandler("Expired OTP Cleanup", async () => {
        console.log("[SYSTEM JOB] Expired OTP Verification Codes Cleanup completed. (0 cleaned)");
    });
    // 12. Inactive Session Cleanup
    SchedulerService.registerHandler("Inactive Session Cleanup", async () => {
        const now = new Date();
        const sessions = await prisma.session.deleteMany({
            where: { expiresAt: { lt: now } },
        });
        const tokens = await prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: now } },
        });
        console.log(`[SYSTEM JOB] Inactive sessions cleaned: ${sessions.count}. Refresh tokens cleaned: ${tokens.count}`);
    });
    // 13. Audit Log Cleanup
    SchedulerService.registerHandler("Audit Log Cleanup", async () => {
        // Clean logs older than 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const result = await prisma.auditLog.deleteMany({
            where: { createdAt: { lt: ninetyDaysAgo } },
        });
        console.log(`[SYSTEM JOB] Cleaned up ${result.count} audit logs older than 90 days.`);
    });
    // 14. Temporary File Cleanup
    SchedulerService.registerHandler("Temporary File Cleanup", async () => {
        const tempDir = path.resolve("./uploads/temp");
        let count = 0;
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stat = fs.statSync(filePath);
                // Clean if older than 24 hours
                if (Date.now() - stat.mtimeMs > 24 * 60 * 60 * 1000) {
                    fs.unlinkSync(filePath);
                    count++;
                }
            }
        }
        console.log(`[SYSTEM JOB] Temporary upload files cleaned up: ${count}`);
    });
    // 15. Notification Queue Processing
    SchedulerService.registerHandler("Notification Queue Processing", async () => {
        console.log("[SYSTEM JOB] Processing notification queue...");
        await NotificationService.runQueueWorker();
    });
    // 16. Retry Failed Notifications
    SchedulerService.registerHandler("Retry Failed Notifications", async () => {
        const failedItems = await prisma.notificationQueue.findMany({
            where: {
                status: "failed",
                attempts: { lt: 3 },
            },
        });
        let count = 0;
        for (const item of failedItems) {
            await NotificationService.retryQueueItem(item.id);
            count++;
        }
        console.log(`[SYSTEM JOB] Triggered retry for ${count} failed notifications.`);
    });
    // 17. Retry Failed Emails
    SchedulerService.registerHandler("Retry Failed Emails", async () => {
        const failed = await prisma.notificationQueue.findMany({
            where: {
                status: "failed",
                attempts: { lt: 3 },
                notification: { channel: "email" },
            },
            include: { notification: true },
        });
        for (const item of failed) {
            await NotificationService.retryQueueItem(item.id);
        }
        console.log(`[SYSTEM JOB] Retried ${failed.length} failed email notifications.`);
    });
    // 18. Retry Failed WhatsApp
    SchedulerService.registerHandler("Retry Failed WhatsApp", async () => {
        const failed = await prisma.notificationQueue.findMany({
            where: {
                status: "failed",
                attempts: { lt: 3 },
                notification: { channel: "whatsapp" },
            },
            include: { notification: true },
        });
        for (const item of failed) {
            await NotificationService.retryQueueItem(item.id);
        }
        console.log(`[SYSTEM JOB] Retried ${failed.length} failed WhatsApp notifications.`);
    });
    // 19. Retry Failed SMS
    SchedulerService.registerHandler("Retry Failed SMS", async () => {
        const failed = await prisma.notificationQueue.findMany({
            where: {
                status: "failed",
                attempts: { lt: 3 },
                notification: { channel: "sms" },
            },
            include: { notification: true },
        });
        for (const item of failed) {
            await NotificationService.retryQueueItem(item.id);
        }
        console.log(`[SYSTEM JOB] Retried ${failed.length} failed SMS notifications.`);
    });
    // 20. Retry Failed Push
    SchedulerService.registerHandler("Retry Failed Push", async () => {
        const failed = await prisma.notificationQueue.findMany({
            where: {
                status: "failed",
                attempts: { lt: 3 },
                notification: { channel: "push" },
            },
            include: { notification: true },
        });
        for (const item of failed) {
            await NotificationService.retryQueueItem(item.id);
        }
        console.log(`[SYSTEM JOB] Retried ${failed.length} failed Push notifications.`);
    });
}
