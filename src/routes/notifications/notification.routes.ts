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
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { Response, NextFunction } from "express";

const adminOnly = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
  // Admin users have type:"admin" in their JWT (set by the adminUser login path).
  // Their role field can be any named role (super_admin, Admin, etc.).
  if (req.user.type === "admin" || req.user.role === "super_admin") {
    return next();
  }
  return res.status(403).json({ success: false, message: "Admin access required" });
};

const router = Router();
router.use(authMiddleware as any);
router.use(adminOnly as any);

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
