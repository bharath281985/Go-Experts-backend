import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where: { userId: req.user.id } })
    ]);

    const shaped = notifications.map((n) => ({
      ...n,
      body: n.message,
      isRead: Boolean(n.readAt),
      read: Boolean(n.readAt),
      category: n.type || 'system',
    }));

    return res.json(successResponse('Notifications retrieved', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user.id, readAt: null }
    });
    return res.json(successResponse('Unread count retrieved', { count }));
  } catch (error) { next(error); }
};

export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { readAt: new Date() }
    });
    return res.json(successResponse('Notification marked as read'));
  } catch (error) { next(error); }
};

export const markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() }
    });
    return res.json(successResponse('All notifications marked as read'));
  } catch (error) { next(error); }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    return res.json(successResponse('Notification deleted'));
  } catch (error) { next(error); }
};

export const getPreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let prefs = await prisma.notificationPreference.findUnique({ where: { userId: req.user.id } });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: req.user.id }
      });
    }
    return res.json(successResponse('Preferences retrieved', prefs));
  } catch (error) { next(error); }
};

export const updatePreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { emailEnabled, pushEnabled, inAppEnabled, marketingEmails, securityAlerts, messageNotifications, updateNotifications } = req.body;
    
    const extraPrefs = JSON.stringify({ marketingEmails, securityAlerts, messageNotifications, updateNotifications });

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.user.id },
      update: { emailEnabled, pushEnabled, inAppEnabled, preferences: extraPrefs },
      create: { 
        userId: req.user.id, 
        emailEnabled, pushEnabled, inAppEnabled, preferences: extraPrefs 
      }
    });
    
    return res.json(successResponse('Preferences updated', prefs));
  } catch (error) { next(error); }
};

export const testPush = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await NotificationEngine.queueNotification({
      userId: req.user.id,
      type: 'test_push',
      title: 'Test Push Notification',
      message: 'This is a test push notification from Go Experts',
      channel: 'push',
      payload: { title: 'Test Push', message: 'It works!' }
    });
    return res.json(successResponse('Test push notification queued'));
  } catch (error) { next(error); }
};

export const testEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await NotificationEngine.queueNotification({
      userId: req.user.id,
      type: 'test_email',
      title: 'Test Email',
      message: 'This is a test email notification from Go Experts',
      channel: 'email',
      payload: { title: 'Test Email', message: 'It works!' }
    });
    return res.json(successResponse('Test email notification queued'));
  } catch (error) { next(error); }
};
