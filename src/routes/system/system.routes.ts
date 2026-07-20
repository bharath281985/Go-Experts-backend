import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getSystemHealth,
  getApiLogs,
  getApiErrors,
  getApiStats,
  getDatabaseStats,
  getStorageStats,
  getJobStats,
  getQueueStats,
  getSecurityOverview,
  getLoginAttempts,
  getActiveSessions,
  revokeSession,
  getOperationsDashboard,
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  createAlert,
  getBackupStats,
  triggerManualBackup,
} from "../../controllers/system/system.controller.js";

const router = Router();

// All system endpoints require authentication
router.use(authMiddleware as any);

// ─────────────────────────────────────────────
// MODULE 1: System Health
// ─────────────────────────────────────────────
router.get("/health", getSystemHealth);

// ─────────────────────────────────────────────
// MODULE 2: API Monitoring
// ─────────────────────────────────────────────
router.get("/api-logs",  getApiLogs);
router.get("/api-errors", getApiErrors);
router.get("/api-stats",  getApiStats);

// ─────────────────────────────────────────────
// MODULE 3: Database Monitoring
// ─────────────────────────────────────────────
router.get("/database", getDatabaseStats);

// ─────────────────────────────────────────────
// MODULE 4: Storage Monitoring
// ─────────────────────────────────────────────
router.get("/storage", getStorageStats);

// ─────────────────────────────────────────────
// MODULE 5: Job & Queue Monitoring
// ─────────────────────────────────────────────
router.get("/jobs",   getJobStats);
router.get("/queues", getQueueStats);

// ─────────────────────────────────────────────
// MODULE 6: Security Monitoring
// ─────────────────────────────────────────────
router.get("/security",       getSecurityOverview);
router.get("/login-attempts", getLoginAttempts);
router.get("/sessions",       getActiveSessions);
router.delete("/sessions/:id", revokeSession);

// ─────────────────────────────────────────────
// MODULE 7: Operations Dashboard
// ─────────────────────────────────────────────
router.get("/operations-dashboard", getOperationsDashboard);

// ─────────────────────────────────────────────
// MODULE 8: Alert System
// ─────────────────────────────────────────────
router.get("/alerts",                       getAlerts);
router.post("/alerts",                      createAlert);
router.patch("/alerts/:id/acknowledge",     acknowledgeAlert);
router.patch("/alerts/:id/resolve",         resolveAlert);

// ─────────────────────────────────────────────
// MODULE 9: Backup Monitoring
// ─────────────────────────────────────────────
router.get("/backups",          getBackupStats);
router.post("/backups/trigger", triggerManualBackup);

export default router;
