import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  scheduleReport,
  generateReportImmediately,
  triggerBackup,
  getBackupsList,
  restoreBackup,
  getSystemHealth,
  getDashboardSchedulerStats
} from "../../controllers/scheduler/system-ops.controller.js";

const router = Router();

router.use(authMiddleware as any);

// Report routes
router.post("/reports/schedule", scheduleReport);
router.post("/reports/generate", generateReportImmediately);

// Backup routes
router.post("/backups/trigger", triggerBackup);
router.get("/backups", getBackupsList);
router.post("/backups/:id/restore", restoreBackup);

// Health check and Dashboard stats
router.get("/system/health", getSystemHealth);
router.get("/dashboard/scheduler-stats", getDashboardSchedulerStats);

export default router;
