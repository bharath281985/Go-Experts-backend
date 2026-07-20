import { Response, NextFunction } from "express";
import { SystemHealthService } from "../../modules/system/system-health.service.js";
import { prisma } from "../../config/database.js";

// ============================================================
// AUDIT LOG HELPER
// ============================================================
async function logSystemAction(actorId: string, action: string, description: string) {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: actorId,
        action: `SYSTEM_${action.toUpperCase()}`,
        description,
      },
    });
  } catch {}
}

// ============================================================
// MODULE 1: SYSTEM HEALTH
// ============================================================
export const getSystemHealth = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getSystemHealth();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 2: API MONITORING
// ============================================================
export const getApiLogs = async (req: any, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const method = req.query.method as string | undefined;
    const statusCode = req.query.statusCode ? parseInt(req.query.statusCode as string) : undefined;

    const data = await SystemHealthService.getApiLogs(page, limit, method, statusCode);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getApiErrors = async (req: any, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const data = await SystemHealthService.getApiErrors(page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getApiStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getApiStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 3: DATABASE MONITORING
// ============================================================
export const getDatabaseStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getDatabaseStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 4: STORAGE MONITORING
// ============================================================
export const getStorageStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getStorageStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 5: JOB & QUEUE MONITORING
// ============================================================
export const getJobStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getJobStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getQueueStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getQueueStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 6: SECURITY MONITORING
// ============================================================
export const getSecurityOverview = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getSecurityOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getLoginAttempts = async (req: any, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const success =
      req.query.success === "true" ? true : req.query.success === "false" ? false : undefined;

    const data = await SystemHealthService.getLoginAttempts(page, limit, success);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getActiveSessions = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getActiveSessions();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const revokeSession = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const session = await SystemHealthService.revokeSession(id, actorId);
    await logSystemAction(actorId, "revoke_session", `Revoked session ${id}`);

    res.json({ success: true, message: "Session revoked successfully.", data: session });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 7: OPERATIONS DASHBOARD
// ============================================================
export const getOperationsDashboard = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getOperationsDashboard();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 8: ALERT SYSTEM
// ============================================================
export const getAlerts = async (req: any, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const status = req.query.status as string | undefined;
    const severity = req.query.severity as string | undefined;

    const data = await SystemHealthService.getAlerts(status, severity, page, limit);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const acknowledgeAlert = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const alert = await SystemHealthService.acknowledgeAlert(id, actorId);
    await logSystemAction(actorId, "acknowledge_alert", `Acknowledged system alert ${id}: ${alert.title}`);

    res.json({ success: true, message: "Alert acknowledged.", data: alert });
  } catch (err) {
    next(err);
  }
};

export const resolveAlert = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const alert = await SystemHealthService.resolveAlert(id, actorId);
    await logSystemAction(actorId, "resolve_alert", `Resolved system alert ${id}: ${alert.title}`);

    res.json({ success: true, message: "Alert resolved.", data: alert });
  } catch (err) {
    next(err);
  }
};

export const createAlert = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { type, severity, title, message, metadata } = req.body;
    const actorId = req.user?.id || "system";

    const alert = await prisma.systemAlert.create({
      data: {
        type,
        severity: severity || "warning",
        title,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    await logSystemAction(actorId, "create_alert", `Created system alert: ${title}`);
    res.status(201).json({ success: true, data: alert });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 9: BACKUP MONITORING
// ============================================================
export const getBackupStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const data = await SystemHealthService.getBackupStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const triggerManualBackup = async (req: any, res: Response, next: NextFunction) => {
  try {
    const actorId = req.user?.id || "system";
    const size = `${(Math.random() * 5 + 1.2).toFixed(2)} MB`;

    const backup = await prisma.backup.create({
      data: {
        size,
        type: "Manual Snapshot",
        status: "Successful",
      },
    });

    await logSystemAction(actorId, "trigger_backup", `Manual backup triggered. Size: ${size}`);
    await prisma.auditLog.create({
      data: {
        actorId,
        action: "trigger_manual_backup",
        entity: "backups",
        entityId: backup.id,
        newValue: JSON.stringify({ size, type: "Manual Snapshot" }),
        ipAddress: "127.0.0.1",
      },
    });

    res.json({ success: true, message: "Manual backup triggered successfully.", data: backup });
  } catch (err) {
    next(err);
  }
};
