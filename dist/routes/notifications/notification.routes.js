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
getLogs, getNotificationDashboardStats, } from "../../controllers/notifications/notification.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = Router();
router.use(authMiddleware);
// ── Notifications CRUD & Read Status ──
router.get("/", listNotifications);
router.post("/", createNotification);
router.patch("/mark-all-read", markAllRead);
router.get("/dashboard-stats", getNotificationDashboardStats);
router.get("/:id", getNotificationDetails);
router.patch("/:id/read", markRead);
router.delete("/:id", deleteNotification);
// ── User Preferences ──
router.get("/preferences/:userId", getPreferences);
router.put("/preferences/:userId", updatePreferences);
// ── Templates CRUD ──
router.get("/templates", listTemplates);
router.post("/templates", createTemplate);
router.put("/templates/:id", updateTemplate);
router.delete("/templates/:id", deleteTemplate);
// ── Campaigns ──
router.get("/campaigns", listCampaigns);
router.post("/campaigns", createCampaign);
router.post("/campaigns/:id/send", sendCampaign);
router.post("/campaigns/:id/cancel", cancelCampaign);
// ── Channels Config ──
router.get("/channels", listChannels);
router.put("/channels/:id", updateChannelConfig);
// ── Log and Queue exports for mounting at custom routes ──
export const queueRouter = Router();
queueRouter.use(authMiddleware);
queueRouter.get("/", getNotificationQueue);
queueRouter.post("/:id/retry", retryQueueItem);
queueRouter.post("/:id/cancel", cancelQueueItem);
export const logsRouter = Router();
logsRouter.use(authMiddleware);
logsRouter.get("/", getLogs);
export default router;
