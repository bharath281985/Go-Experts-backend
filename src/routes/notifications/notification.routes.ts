import { Router } from "express";
import {
  // Notifications
  listNotifications, getNotificationDetails, createNotification, markRead, markAllRead, deleteNotification,
  // Queue
  getNotificationQueue, retryQueueItem, cancelQueueItem,
  // Preferences
  getPreferences, updatePreferences,
  // Templates
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  // Campaigns
  listCampaigns, createCampaign, sendCampaign, cancelCampaign,
  // Channels
  listChannels, updateChannelConfig,
  // Stats & Logs
  getLogs, getNotificationDashboardStats,
} from "../../controllers/notifications/notification.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware as any);

// ── Notifications CRUD & Read Status ──
router.get("/", listNotifications as any);
router.post("/", createNotification as any);
router.patch("/mark-all-read", markAllRead as any);
router.get("/dashboard-stats", getNotificationDashboardStats as any);
router.get("/:id", getNotificationDetails as any);
router.patch("/:id/read", markRead as any);
router.delete("/:id", deleteNotification as any);

// ── User Preferences ──
router.get("/preferences/:userId", getPreferences as any);
router.put("/preferences/:userId", updatePreferences as any);

// ── Templates CRUD ──
router.get("/templates", listTemplates as any);
router.post("/templates", createTemplate as any);
router.put("/templates/:id", updateTemplate as any);
router.delete("/templates/:id", deleteTemplate as any);

// ── Campaigns ──
router.get("/campaigns", listCampaigns as any);
router.post("/campaigns", createCampaign as any);
router.post("/campaigns/:id/send", sendCampaign as any);
router.post("/campaigns/:id/cancel", cancelCampaign as any);

// ── Channels Config ──
router.get("/channels", listChannels as any);
router.put("/channels/:id", updateChannelConfig as any);

// ── Log and Queue exports for mounting at custom routes ──
export const queueRouter = Router();
queueRouter.use(authMiddleware as any);
queueRouter.get("/", getNotificationQueue as any);
queueRouter.post("/:id/retry", retryQueueItem as any);
queueRouter.post("/:id/cancel", cancelQueueItem as any);

export const logsRouter = Router();
logsRouter.use(authMiddleware as any);
logsRouter.get("/", getLogs as any);

export default router;
