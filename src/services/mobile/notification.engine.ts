import { prisma } from '../../config/database.js';
import { sendEmail } from './email.service.js';
import { sendPushNotification } from './push.service.js';

export class NotificationEngine {
  
  /**
   * Queue a notification for processing.
   */
  static async queueNotification(data: {
    userId: string,
    type: string,
    title: string,
    message: string,
    channel: 'in_app' | 'email' | 'push' | 'all',
    payload?: any,
    scheduledAt?: Date
  }) {
    if (data.channel === 'all') {
      await this.createQueueItem(data.userId, data.type, data.title, data.message, 'in_app', data.payload, data.scheduledAt);
      await this.createQueueItem(data.userId, data.type, data.title, data.message, 'email', data.payload, data.scheduledAt);
      await this.createQueueItem(data.userId, data.type, data.title, data.message, 'push', data.payload, data.scheduledAt);
    } else {
      await this.createQueueItem(data.userId, data.type, data.title, data.message, data.channel, data.payload, data.scheduledAt);
    }
  }

  private static async createQueueItem(userId: string, type: string, title: string, message: string, channel: string, payload?: any, scheduledAt?: Date) {
    // Check preferences first
    const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
    if (prefs) {
      if (channel === 'email' && !prefs.emailEnabled) return;
      if (channel === 'push' && !prefs.pushEnabled) return;
      if (channel === 'in_app' && !prefs.inAppEnabled) return;
    }

    // Create Notification first
    const notification = await prisma.notification.create({
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
    await prisma.notificationQueue.create({
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
    const items = await prisma.notificationQueue.findMany({
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

  private static async processItem(item: any) {
    try {
      await prisma.notificationQueue.update({ where: { id: item.id }, data: { status: 'processing', attempts: item.attempts + 1 } });
      
      let success = false;
      const user = item.notification.userId ? await prisma.user.findUnique({ where: { id: item.notification.userId } }) : null;

      if (!user) {
         // Some notifications might be broadcast, but skipping for now
         throw new Error('User not found');
      }

      if (item.notification.channel === 'in_app') {
        await prisma.notification.update({
          where: { id: item.notification.id },
          data: { status: 'delivered' }
        });
        success = true;
      } else if (item.notification.channel === 'email') {
        success = Boolean(await sendEmail(user.email, item.notification.title, item.notification.message));
      } else if (item.notification.channel === 'push') {
        let dataPayload;
        try { dataPayload = item.notification.metadata ? JSON.parse(item.notification.metadata) : undefined; } catch (e) {}
        success = Boolean(await sendPushNotification(user.id, item.notification.title, item.notification.message, dataPayload));
      }

      if (success) {
        await prisma.notificationQueue.update({ where: { id: item.id }, data: { status: 'completed' } });
        await prisma.notification.update({ where: { id: item.notification.id }, data: { status: 'delivered', sentAt: new Date() } });
        await this.logNotification(item.notification.id, user.id, item.notification.channel, 'delivered');
      } else {
        await this.handleFailure(item, new Error('Delivery failed'));
      }
    } catch (error: any) {
      await this.handleFailure(item, error);
    }
  }

  private static async handleFailure(item: any, error: Error) {
    const status = item.attempts >= item.maxAttempts - 1 ? 'failed' : 'pending';
    await prisma.notificationQueue.update({
      where: { id: item.id },
      data: { status, error: error.message }
    });
    
    await prisma.notificationDeliveryAttempt.create({
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
      await prisma.notification.update({ where: { id: item.notification.id }, data: { status: 'failed', failedAt: new Date() } });
      if (item.notification.userId) {
         await this.logNotification(item.notification.id, item.notification.userId, item.notification.channel, 'failed');
      }
    }
  }

  private static async logNotification(notificationId: string, userId: string, channel: string, status: string) {
    await prisma.notificationLog.create({
      data: { notificationId, userId, channel, status }
    });
  }

  /**
   * Retry failed items
   */
  static async retryFailed() {
    await prisma.notificationQueue.updateMany({
      where: { status: 'failed', attempts: { lt: 5 } },
      data: { status: 'pending' }
    });
  }
}
