import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../../modules/notifications/notification.service.js";
import { prisma } from "../../config/database.js";

// ============================================================
// LOGGING HELPERS
// ============================================================

async function logNotificationAction(params: {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}) {
  const { actorId, action, entity, entityId, description, oldValue, newValue } = params;

  // Create activity log
  await prisma.activityLog.create({
    data: {
      adminUserId: actorId,
      action: `${action}_${entity}`,
      description,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null,
      diff: oldValue && newValue ? JSON.stringify({ from: oldValue, to: newValue }) : null,
      ipAddress: "127.0.0.1",
    },
  });
}

// ============================================================
// 1. NOTIFICATIONS CRUD
// ============================================================

export const listNotifications = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { status, channel, type, page = "1", limit = "20" } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (type) where.type = type;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where, skip, take: parseInt(limit as string),
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getNotificationDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const notif = await prisma.notification.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        queueRecord: true,
        deliveryAttempts: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });
    res.json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
};

export const createNotification = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { userId, role, type, title, message, channel, priority, scheduledAt, variables, metadata } = req.body;
    const actorId = req.user?.id || "system";

    const notifications = await NotificationService.enqueue({
      userId, role, type: type || "system",
      title, message, channel: channel || "in_app",
      priority: priority || "normal",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      variables, metadata,
    });

    await logNotificationAction({
      actorId, action: "create", entity: "Notification",
      entityId: notifications[0]?.id || "multi",
      description: `Manually enqueued ${notifications.length} notifications of type "${type || "system"}"`,
      newValue: notifications,
    });

    res.status(201).json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

export const markRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const notif = await prisma.notification.update({
      where: { id },
      data: { status: "read", readAt: new Date() },
    });
    res.json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body;
    const where: any = { status: "sent" };
    if (userId) where.userId = userId;

    await prisma.notification.updateMany({
      where,
      data: { status: "read", readAt: new Date() },
    });

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    next(err);
  }
};

export const deleteNotification = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Notification not found" });

    await prisma.notification.delete({ where: { id } });

    await logNotificationAction({
      actorId, action: "delete", entity: "Notification", entityId: id,
      description: `Deleted notification "${existing.title}"`,
      oldValue: existing,
    });

    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// 2. QUEUE MANAGEMENT
// ============================================================

export const getNotificationQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [queue, total] = await Promise.all([
      prisma.notificationQueue.findMany({
        where, skip, take: parseInt(limit as string),
        include: { notification: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notificationQueue.count({ where }),
    ]);

    res.json({
      success: true,
      data: queue,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const retryQueueItem = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const updated = await NotificationService.retryQueueItem(id);

    await logNotificationAction({
      actorId, action: "retry", entity: "NotificationQueue", entityId: id,
      description: `Triggered queue item retry for item id ${id}`,
      newValue: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const cancelQueueItem = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const updated = await NotificationService.cancelQueueItem(id);

    await logNotificationAction({
      actorId, action: "cancel", entity: "NotificationQueue", entityId: id,
      description: `Cancelled queue item release for item id ${id}`,
      newValue: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// 3. USER PREFERENCES
// ============================================================

export const getPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    let pref = await prisma.notificationPreference.findUnique({ where: { userId } });
    if (!pref) {
      pref = await prisma.notificationPreference.create({
        data: { userId, emailEnabled: true, pushEnabled: true, smsEnabled: false, whatsappEnabled: false, inAppEnabled: true, preferences: "{}" },
      });
    }
    res.json({ success: true, data: pref });
  } catch (err) {
    next(err);
  }
};

export const updatePreferences = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { emailEnabled, pushEnabled, smsEnabled, whatsappEnabled, inAppEnabled, preferences } = req.body;
    const actorId = req.user?.id || "system";

    const existing = await prisma.notificationPreference.findUnique({ where: { userId } });

    const updated = await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId, emailEnabled: emailEnabled ?? true, pushEnabled: pushEnabled ?? true,
        smsEnabled: smsEnabled ?? false, whatsappEnabled: whatsappEnabled ?? false,
        inAppEnabled: inAppEnabled ?? true, preferences: preferences ? JSON.stringify(preferences) : "{}",
      },
      update: {
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(pushEnabled !== undefined && { pushEnabled }),
        ...(smsEnabled !== undefined && { smsEnabled }),
        ...(whatsappEnabled !== undefined && { whatsappEnabled }),
        ...(inAppEnabled !== undefined && { inAppEnabled }),
        ...(preferences !== undefined && { preferences: JSON.stringify(preferences) }),
      },
    });

    await logNotificationAction({
      actorId, action: "update", entity: "NotificationPreference", entityId: userId,
      description: `Updated notification channel preferences for user ID ${userId}`,
      oldValue: existing, newValue: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// 4. DELIVERY LOGS
// ============================================================

export const getLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel, status, page = "1", limit = "20" } = req.query;
    const where: any = {};
    if (channel) where.channel = channel;
    if (status) where.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where, skip, take: parseInt(limit as string),
        include: { user: { select: { id: true, fullName: true, email: true } }, notification: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notificationLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// 5. TEMPLATES CRUD
// ============================================================

export const listTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      orderBy: { code: "asc" },
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
};

export const createTemplate = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { name, code, channel, subject, body, variables, status, language, role, category } = req.body;
    const actorId = req.user?.id || "system";

    const t = await prisma.notificationTemplate.create({
      data: {
        name, code, channel, subject: subject || null, body,
        variables: variables ? JSON.stringify(variables) : null,
        status: status || "active", language: language || "en",
        role: role || null, category: category || null,
      },
    });

    await logNotificationAction({
      actorId, action: "create", entity: "NotificationTemplate", entityId: t.id,
      description: `Created notification template "${name}" with code "${code}"`,
      newValue: t,
    });

    res.status(201).json({ success: true, data: t });
  } catch (err) {
    next(err);
  }
};

export const updateTemplate = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, code, channel, subject, body, variables, status, language, role, category } = req.body;
    const actorId = req.user?.id || "system";

    const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Template not found" });

    const updated = await prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(name && { name }), ...(code && { code }), ...(channel && { channel }),
        ...(subject !== undefined && { subject }), ...(body && { body }),
        ...(variables !== undefined && { variables: JSON.stringify(variables) }),
        ...(status && { status }), ...(language && { language }),
        ...(role !== undefined && { role }), ...(category !== undefined && { category }),
      },
    });

    await logNotificationAction({
      actorId, action: "update", entity: "NotificationTemplate", entityId: id,
      description: `Updated template code "${existing.code}" settings`,
      oldValue: existing, newValue: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteTemplate = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const existing = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Template not found" });

    await prisma.notificationTemplate.delete({ where: { id } });

    await logNotificationAction({
      actorId, action: "delete", entity: "NotificationTemplate", entityId: id,
      description: `Deleted notification template "${existing.name}" (${existing.code})`,
      oldValue: existing,
    });

    res.json({ success: true, message: "Template deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// 6. CAMPAIGN MANAGEMENT
// ============================================================

export const listCampaigns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaigns = await prisma.notificationCampaign.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
};

export const createCampaign = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { title, message, targetFilter, channels, scheduledAt } = req.body;
    const actorId = req.user?.id || "system";

    const campaign = await prisma.notificationCampaign.create({
      data: {
        title, message,
        targetFilter: JSON.stringify(targetFilter || {}),
        channels: JSON.stringify(channels || ["in_app"]),
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? "scheduled" : "draft",
      },
    });

    await logNotificationAction({
      actorId, action: "create", entity: "NotificationCampaign", entityId: campaign.id,
      description: `Created communication campaign: "${title}"`,
      newValue: campaign,
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

export const sendCampaign = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    await NotificationService.executeCampaign(id);

    await logNotificationAction({
      actorId, action: "send", entity: "NotificationCampaign", entityId: id,
      description: `Dispatched campaign id ${id} to targets`,
    });

    res.json({ success: true, message: "Campaign dispatch complete" });
  } catch (err) {
    next(err);
  }
};

export const cancelCampaign = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const updated = await prisma.notificationCampaign.update({
      where: { id },
      data: { status: "cancelled" },
    });

    await logNotificationAction({
      actorId, action: "cancel", entity: "NotificationCampaign", entityId: id,
      description: `Cancelled scheduled campaign id ${id}`,
      newValue: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// 7. COMMUNICATION CHANNELS CONFIG
// ============================================================

export const listChannels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const channels = await prisma.communicationChannel.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: channels });
  } catch (err) {
    next(err);
  }
};

export const updateChannelConfig = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { provider, config, status } = req.body;
    const actorId = req.user?.id || "system";

    const existing = await prisma.communicationChannel.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Channel not found" });

    const updated = await prisma.communicationChannel.update({
      where: { id },
      data: {
        ...(provider && { provider }),
        ...(config && { config: JSON.stringify(config) }),
        ...(status && { status }),
      },
    });

    await logNotificationAction({
      actorId, action: "update", entity: "CommunicationChannel", entityId: id,
      description: `Updated config for channel provider "${existing.name}"`,
      oldValue: existing, newValue: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// 8. NOTIFICATION ENGINE DASHBOARD WIDGETS
// ============================================================

export const getNotificationDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      total, queued, sent, failed,
      emailSent, whatsappSent, smsSent, pushSent, inAppSent,
      emailFailed, whatsappFailed, smsFailed, pushFailed, inAppFailed,
      retriesCount, readCount,
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { status: "queued" } }),
      prisma.notification.count({ where: { status: "sent" } }),
      prisma.notification.count({ where: { status: "failed" } }),
      // Successes by channel
      prisma.notification.count({ where: { channel: "email", status: "sent" } }),
      prisma.notification.count({ where: { channel: "whatsapp", status: "sent" } }),
      prisma.notification.count({ where: { channel: "sms", status: "sent" } }),
      prisma.notification.count({ where: { channel: "push", status: "sent" } }),
      prisma.notification.count({ where: { channel: "in_app", status: "sent" } }),
      // Failures by channel
      prisma.notification.count({ where: { channel: "email", status: "failed" } }),
      prisma.notification.count({ where: { channel: "whatsapp", status: "failed" } }),
      prisma.notification.count({ where: { channel: "sms", status: "failed" } }),
      prisma.notification.count({ where: { channel: "push", status: "failed" } }),
      prisma.notification.count({ where: { channel: "in_app", status: "failed" } }),
      // Retries (delivery attempts list count > 1)
      prisma.notificationQueue.aggregate({
        where: { attempts: { gt: 1 } },
        _sum: { attempts: true },
      }),
      // Read count
      prisma.notification.count({ where: { status: "read" } }),
    ]);

    const sentTotal = sent + readCount;
    const readRate = sentTotal > 0 ? parseFloat(((readCount / sentTotal) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      data: {
        total,
        queued,
        sent: sentTotal,
        failed,
        readRate,
        byChannel: {
          email: { sent: emailSent, failed: emailFailed },
          whatsapp: { sent: whatsappSent, failed: whatsappFailed },
          sms: { sent: smsSent, failed: smsFailed },
          push: { sent: pushSent, failed: pushFailed },
          inApp: { sent: inAppSent, failed: inAppFailed },
        },
        retryCount: retriesCount._sum.attempts || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};
