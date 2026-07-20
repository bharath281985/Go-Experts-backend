import { prisma } from "../../config/database.js";
import fs from "fs";
import path from "path";
import os from "os";

export class SystemHealthService {
  // ============================================================
  // MODULE 1: COMPREHENSIVE SYSTEM HEALTH
  // ============================================================
  static async getSystemHealth() {
    const startTime = Date.now();

    // 1. Database status + response time
    let dbStatus = "connected";
    let dbResponseTime = 0;
    try {
      const t0 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - t0;
    } catch {
      dbStatus = "disconnected";
    }

    // 2. Storage check
    const uploadsDir = path.resolve("./uploads");
    const storageStatus = fs.existsSync(uploadsDir) ? "available" : "unavailable";
    let storageUsed = "0 MB";
    try {
      if (fs.existsSync(uploadsDir)) {
        let total = 0;
        const walk = (dir: string) => {
          for (const f of fs.readdirSync(dir)) {
            const fp = path.join(dir, f);
            const st = fs.statSync(fp);
            if (st.isDirectory()) walk(fp);
            else total += st.size;
          }
        };
        walk(uploadsDir);
        storageUsed = `${(total / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch {}

    // 3. DB file size
    let dbSize = "Unknown";
    try {
      const dbPath = path.resolve("./prisma/dev.db");
      if (fs.existsSync(dbPath)) {
        const s = fs.statSync(dbPath);
        dbSize = `${(s.size / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch {}

    // 4. Scheduler + queue status
    const [activeJobs, failedJobs, pendingQueue, failedQueue] = await Promise.all([
      prisma.scheduledJob.count({ where: { status: "active" } }),
      prisma.scheduledJob.count({ where: { status: "failed" } }),
      prisma.notificationQueue.count({ where: { status: "pending" } }),
      prisma.notificationQueue.count({ where: { status: "failed" } }),
    ]);

    // 5. Memory
    const mem = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    // 6. Active sessions
    const activeSessions = await prisma.session.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
    });

    return {
      status: "healthy",
      timestamp: new Date(),
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      database: {
        status: dbStatus,
        responseTimeMs: dbResponseTime,
        fileSize: dbSize,
      },
      api: {
        status: "healthy",
        uptime: process.uptime(),
      },
      storage: {
        status: storageStatus,
        used: storageUsed,
        directory: uploadsDir,
      },
      memory: {
        system: {
          free: `${(freeMem / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          total: `${(totalMem / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          usedPercent: `${((1 - freeMem / totalMem) * 100).toFixed(1)}%`,
        },
        process: {
          rss: `${(mem.rss / (1024 * 1024)).toFixed(2)} MB`,
          heapUsed: `${(mem.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
          heapTotal: `${(mem.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
        },
      },
      cpu: {
        model: os.cpus()[0]?.model || "Unknown",
        cores: os.cpus().length,
        usagePlaceholder: "< 5%",
      },
      scheduler: {
        status: activeJobs > 0 ? "running" : "idle",
        activeJobs,
        failedJobs,
      },
      notificationQueue: {
        pending: pendingQueue,
        failed: failedQueue,
      },
      sessions: {
        active: activeSessions,
      },
      checkDurationMs: Date.now() - startTime,
    };
  }

  // ============================================================
  // MODULE 2: API MONITORING
  // ============================================================
  static async getApiLogs(page = 1, limit = 50, method?: string, statusCode?: number) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (method) where.method = method.toUpperCase();
    if (statusCode) where.statusCode = statusCode;

    const [logs, total] = await Promise.all([
      prisma.apiRequestLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.apiRequestLog.count({ where }),
    ]);

    return { logs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async getApiErrors(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = { statusCode: { gte: 400 } };

    const [logs, total] = await Promise.all([
      prisma.apiRequestLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.apiRequestLog.count({ where }),
    ]);

    return { logs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async getApiStats() {
    const [total, successCount, errorCount] = await Promise.all([
      prisma.apiRequestLog.count(),
      prisma.apiRequestLog.count({ where: { statusCode: { lt: 400 } } }),
      prisma.apiRequestLog.count({ where: { statusCode: { gte: 400 } } }),
    ]);

    const avgResp = await prisma.apiRequestLog.aggregate({ _avg: { responseTime: true } });
    const avgResponseTime = avgResp._avg.responseTime || 0;

    // Slowest endpoints (groupBy url, avg responseTime)
    const slowestRaw = await prisma.apiRequestLog.groupBy({
      by: ["url"],
      _avg: { responseTime: true },
      orderBy: { _avg: { responseTime: "desc" } },
      take: 10,
    });

    // Most used endpoints
    const mostUsedRaw = await prisma.apiRequestLog.groupBy({
      by: ["url"],
      _count: true,
      orderBy: { _count: { url: "desc" } },
      take: 10,
    });

    // Status code distribution
    const statusDist = await prisma.apiRequestLog.groupBy({
      by: ["statusCode"],
      _count: true,
      orderBy: { _count: { statusCode: "desc" } },
    });

    // Method distribution
    const methodDist = await prisma.apiRequestLog.groupBy({
      by: ["method"],
      _count: true,
    });

    return {
      total,
      successCount,
      errorCount,
      errorRate: total > 0 ? `${((errorCount / total) * 100).toFixed(2)}%` : "0%",
      avgResponseTimeMs: Math.round(avgResponseTime),
      slowestEndpoints: slowestRaw.map((r) => ({
        url: r.url,
        avgResponseTimeMs: Math.round(r._avg.responseTime || 0),
      })),
      mostUsedEndpoints: mostUsedRaw.map((r) => ({
        url: r.url,
        count: r._count,
      })),
      statusCodeDistribution: statusDist.map((r) => ({
        statusCode: r.statusCode,
        count: r._count,
      })),
      methodDistribution: methodDist.map((r) => ({
        method: r.method,
        count: r._count,
      })),
    };
  }

  // ============================================================
  // MODULE 3: DATABASE MONITORING
  // ============================================================
  static async getDatabaseStats() {
    let dbStatus = "connected";
    let dbResponseTime = 0;
    try {
      const t0 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbResponseTime = Date.now() - t0;
    } catch {
      dbStatus = "disconnected";
    }

    let dbSize = "Unknown";
    try {
      const dbPath = path.resolve("./prisma/dev.db");
      if (fs.existsSync(dbPath)) {
        const s = fs.statSync(dbPath);
        dbSize = `${(s.size / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch {}

    // Record counts for all important tables
    const [
      users, projects, proposals, contracts, reviews,
      startups, investments, meetings,
      subscriptions, payments, invoices, wallets, coupons, referrals,
      supportTickets, notifications, campaigns,
      scheduledJobs, automationRules, cronExecutions,
      auditLogs, activityLogs, apiRequestLogs, loginAttempts, systemAlerts, backups,
      mediaFiles, adminUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.proposal.count(),
      prisma.contract.count(),
      prisma.review.count(),
      prisma.startupIdea.count(),
      prisma.investment.count(),
      prisma.meeting.count(),
      prisma.subscription.count(),
      prisma.payment.count(),
      prisma.invoice.count(),
      prisma.wallet.count(),
      prisma.coupon.count(),
      prisma.referral.count(),
      prisma.supportTicket.count(),
      prisma.notification.count(),
      prisma.notificationCampaign.count(),
      prisma.scheduledJob.count(),
      prisma.automationRule.count(),
      prisma.cronExecution.count(),
      prisma.auditLog.count(),
      prisma.activityLog.count(),
      prisma.apiRequestLog.count(),
      prisma.loginAttempt.count(),
      prisma.systemAlert.count(),
      prisma.backup.count(),
      prisma.mediaFile.count(),
      prisma.adminUser.count(),
    ]);

    return {
      status: dbStatus,
      responseTimeMs: dbResponseTime,
      fileSize: dbSize,
      provider: "SQLite",
      recordCounts: {
        users,
        adminUsers,
        projects,
        proposals,
        contracts,
        reviews,
        startups,
        investments,
        meetings,
        subscriptions,
        payments,
        invoices,
        wallets,
        coupons,
        referrals,
        supportTickets,
        notifications,
        campaigns,
        scheduledJobs,
        automationRules,
        cronExecutions,
        auditLogs,
        activityLogs,
        apiRequestLogs,
        loginAttempts,
        systemAlerts,
        backups,
        mediaFiles,
      },
    };
  }

  // ============================================================
  // MODULE 4: STORAGE MONITORING
  // ============================================================
  static async getStorageStats() {
    const uploadsDir = path.resolve("./uploads");
    const result: any = {
      status: "unavailable",
      directory: uploadsDir,
      totalFiles: 0,
      totalSize: "0 MB",
      totalSizeBytes: 0,
      breakdown: { images: 0, pdfs: 0, videos: 0, others: 0 },
      largestFiles: [],
      recentUploads: [],
    };

    if (!fs.existsSync(uploadsDir)) return result;
    result.status = "available";

    const allFiles: { name: string; path: string; size: number; ext: string; mtime: Date }[] = [];
    const walk = (dir: string) => {
      try {
        for (const f of fs.readdirSync(dir)) {
          const fp = path.join(dir, f);
          const st = fs.statSync(fp);
          if (st.isDirectory()) {
            walk(fp);
          } else {
            const ext = path.extname(f).toLowerCase();
            allFiles.push({ name: f, path: fp, size: st.size, ext, mtime: st.mtime });
          }
        }
      } catch {}
    };
    walk(uploadsDir);

    const totalSizeBytes = allFiles.reduce((acc, f) => acc + f.size, 0);
    result.totalFiles = allFiles.length;
    result.totalSizeBytes = totalSizeBytes;
    result.totalSize = `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`;

    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"];
    const videoExts = [".mp4", ".mov", ".avi", ".mkv", ".webm"];

    result.breakdown.images = allFiles.filter((f) => imageExts.includes(f.ext)).length;
    result.breakdown.pdfs = allFiles.filter((f) => f.ext === ".pdf").length;
    result.breakdown.videos = allFiles.filter((f) => videoExts.includes(f.ext)).length;
    result.breakdown.others =
      result.totalFiles - result.breakdown.images - result.breakdown.pdfs - result.breakdown.videos;

    result.largestFiles = allFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .map((f) => ({
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
        sizeBytes: f.size,
        extension: f.ext,
      }));

    result.recentUploads = allFiles
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
      .slice(0, 10)
      .map((f) => ({
        name: f.name,
        size: `${(f.size / 1024).toFixed(1)} KB`,
        uploadedAt: f.mtime,
        extension: f.ext,
      }));

    // Also pull from MediaFile table
    const dbMediaCount = await prisma.mediaFile.count();
    result.dbMediaRecords = dbMediaCount;

    return result;
  }

  // ============================================================
  // MODULE 5: JOB & QUEUE MONITORING
  // ============================================================
  static async getJobStats() {
    const [total, active, paused, failed, cancelled] = await Promise.all([
      prisma.scheduledJob.count(),
      prisma.scheduledJob.count({ where: { status: "active" } }),
      prisma.scheduledJob.count({ where: { status: "paused" } }),
      prisma.scheduledJob.count({ where: { status: "failed" } }),
      prisma.scheduledJob.count({ where: { status: "cancelled" } }),
    ]);

    const now = new Date();
    const upcomingJobs = await prisma.scheduledJob.findMany({
      where: { status: "active", nextRun: { gte: now } },
      orderBy: { nextRun: "asc" },
      take: 10,
      select: { id: true, name: true, nextRun: true, cronExpression: true, retryCount: true },
    });

    const recentHistory = await prisma.jobHistory.findMany({
      orderBy: { runAt: "desc" },
      take: 20,
      include: { job: { select: { name: true } } },
    });

    const execSummary = await prisma.cronExecution.groupBy({
      by: ["status"],
      _count: true,
    });

    return {
      summary: { total, active, paused, failed, cancelled },
      upcomingJobs,
      recentHistory,
      cronExecutionSummary: execSummary.map((e) => ({ status: e.status, count: e._count })),
    };
  }

  static async getQueueStats() {
    const queueByStatus = await prisma.notificationQueue.groupBy({
      by: ["status"],
      _count: true,
    });

    // Channel breakdown via delivery attempts
    const channelBreakdown = await prisma.notificationDeliveryAttempt.groupBy({
      by: ["channel"],
      _count: true,
    });

    const recentFailed = await prisma.notificationQueue.findMany({
      where: { status: "failed" },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    const totalPending = await prisma.notificationQueue.count({ where: { status: "pending" } });
    const totalFailed = await prisma.notificationQueue.count({ where: { status: "failed" } });

    return {
      byStatus: queueByStatus.map((q) => ({ status: q.status, count: q._count })),
      byChannel: channelBreakdown.map((q) => ({ channel: q.channel, count: q._count })),
      totalPending,
      totalFailed,
      recentFailed,
    };
  }

  // ============================================================
  // MODULE 6: SECURITY MONITORING
  // ============================================================
  static async getSecurityOverview() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalAttempts, successfulLogins, failedLogins,
      attemptsLast24h, failedLast24h,
      activeSessions, expiredSessions, revokedSessions,
      recentAuditLogs, recentActivityLogs,
    ] = await Promise.all([
      prisma.loginAttempt.count(),
      prisma.loginAttempt.count({ where: { success: true } }),
      prisma.loginAttempt.count({ where: { success: false } }),
      prisma.loginAttempt.count({ where: { createdAt: { gte: last24h } } }),
      prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: last24h } } }),
      prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
      prisma.session.count({ where: { expiresAt: { lte: now } } }),
      prisma.session.count({ where: { revokedAt: { not: null } } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { actor: { select: { fullName: true, email: true } } },
      }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { adminUser: { select: { fullName: true, email: true } } },
      }),
    ]);

    // Suspicious IPs: those with more than 5 failed attempts in last 24h
    const suspiciousIPs = await prisma.loginAttempt.groupBy({
      by: ["ipAddress"],
      where: { success: false, createdAt: { gte: last24h } },
      _count: true,
      having: { ipAddress: { _count: { gt: 5 } } },
      orderBy: { _count: { ipAddress: "desc" } },
      take: 10,
    });

    return {
      loginAttempts: {
        total: totalAttempts,
        successful: successfulLogins,
        failed: failedLogins,
        last24h: attemptsLast24h,
        failedLast24h,
      },
      sessions: {
        active: activeSessions,
        expired: expiredSessions,
        revoked: revokedSessions,
      },
      suspiciousIPs: suspiciousIPs.map((s) => ({
        ipAddress: s.ipAddress,
        failedAttempts: s._count,
      })),
      recentAuditLogs,
      recentActivityLogs,
    };
  }

  static async getLoginAttempts(page = 1, limit = 50, success?: boolean) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (success !== undefined) where.success = success;

    const [attempts, total] = await Promise.all([
      prisma.loginAttempt.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.loginAttempt.count({ where }),
    ]);

    return { attempts, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async getActiveSessions() {
    const now = new Date();
    const sessions = await prisma.session.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      include: { adminUser: { select: { fullName: true, email: true, role: true } } },
    });
    return sessions;
  }

  static async revokeSession(sessionId: string, actorId: string) {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "revoke_session",
        entity: "sessions",
        entityId: sessionId,
        newValue: JSON.stringify({ revokedAt: new Date() }),
        ipAddress: "127.0.0.1",
      },
    });

    return session;
  }

  // ============================================================
  // MODULE 7: OPERATIONS DASHBOARD
  // ============================================================
  static async getOperationsDashboard() {
    const now = new Date();
    const last1h = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      totalApiRequests1h, apiErrors1h,
      activeJobs, failedJobs,
      pendingQueue, failedQueue,
      activeSessions,
      failedLoginsLast1h,
      activeAlerts, criticalAlerts,
      lastBackup,
      dbCheck,
    ] = await Promise.all([
      prisma.apiRequestLog.count({ where: { createdAt: { gte: last1h } } }),
      prisma.apiRequestLog.count({ where: { statusCode: { gte: 400 }, createdAt: { gte: last1h } } }),
      prisma.scheduledJob.count({ where: { status: "active" } }),
      prisma.scheduledJob.count({ where: { status: "failed" } }),
      prisma.notificationQueue.count({ where: { status: "pending" } }),
      prisma.notificationQueue.count({ where: { status: "failed" } }),
      prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
      prisma.loginAttempt.count({ where: { success: false, createdAt: { gte: last1h } } }),
      prisma.systemAlert.count({ where: { status: "active" } }),
      prisma.systemAlert.count({ where: { status: "active", severity: "critical" } }),
      prisma.backup.findFirst({ orderBy: { createdAt: "desc" } }),
      prisma.$queryRaw`SELECT 1`.then(() => "connected").catch(() => "disconnected"),
    ]);

    const apiErrorRate = totalApiRequests1h > 0
      ? `${((apiErrors1h / totalApiRequests1h) * 100).toFixed(2)}%`
      : "0%";

    const memory = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    return {
      timestamp: now,
      uptime: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      cards: {
        apiHealth: {
          status: apiErrors1h > (totalApiRequests1h * 0.05) ? "degraded" : "healthy",
          requestsLastHour: totalApiRequests1h,
          errorsLastHour: apiErrors1h,
          errorRate: apiErrorRate,
        },
        database: {
          status: dbCheck,
          label: "SQLite",
        },
        storage: {
          status: fs.existsSync(path.resolve("./uploads")) ? "available" : "unavailable",
        },
        sessions: {
          active: activeSessions,
        },
        jobs: {
          active: activeJobs,
          failed: failedJobs,
          status: failedJobs > 0 ? "warning" : "healthy",
        },
        notificationQueue: {
          pending: pendingQueue,
          failed: failedQueue,
          status: failedQueue > 10 ? "warning" : "healthy",
        },
        security: {
          failedLoginsLastHour: failedLoginsLast1h,
          status: failedLoginsLast1h > 10 ? "warning" : "healthy",
        },
        alerts: {
          active: activeAlerts,
          critical: criticalAlerts,
          status: criticalAlerts > 0 ? "critical" : activeAlerts > 0 ? "warning" : "healthy",
        },
        backup: {
          lastBackup: lastBackup?.createdAt || null,
          lastBackupStatus: lastBackup?.status || "No backup found",
          lastBackupSize: lastBackup?.size || "—",
        },
        memory: {
          processHeapMB: `${(memory.heapUsed / (1024 * 1024)).toFixed(1)} MB`,
          systemUsedPercent: `${((1 - freeMem / totalMem) * 100).toFixed(1)}%`,
        },
      },
    };
  }

  // ============================================================
  // MODULE 8: ALERT SYSTEM
  // ============================================================
  static async getAlerts(status?: string, severity?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const [alerts, total] = await Promise.all([
      prisma.systemAlert.findMany({
        where,
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.systemAlert.count({ where }),
    ]);

    return { alerts, total, page, limit, pages: Math.ceil(total / limit) };
  }

  static async acknowledgeAlert(id: string, actorId: string) {
    const alert = await prisma.systemAlert.update({
      where: { id },
      data: {
        status: "acknowledged",
        acknowledgedBy: actorId,
        acknowledgedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "acknowledge_alert",
        entity: "system_alerts",
        entityId: id,
        newValue: JSON.stringify({ status: "acknowledged" }),
        ipAddress: "127.0.0.1",
      },
    });

    return alert;
  }

  static async resolveAlert(id: string, actorId: string) {
    const alert = await prisma.systemAlert.update({
      where: { id },
      data: {
        status: "resolved",
        resolvedBy: actorId,
        resolvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "resolve_alert",
        entity: "system_alerts",
        entityId: id,
        newValue: JSON.stringify({ status: "resolved" }),
        ipAddress: "127.0.0.1",
      },
    });

    return alert;
  }

  // ============================================================
  // MODULE 9: BACKUP MONITORING
  // ============================================================
  static async getBackupStats() {
    const backups = await prisma.backup.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const lastBackup = backups[0] || null;
    const successfulBackups = backups.filter((b) => b.status === "Successful").length;
    const failedBackups = backups.filter((b) => b.status !== "Successful").length;

    // Calculate next scheduled backup (next midnight)
    const nextBackup = new Date();
    nextBackup.setDate(nextBackup.getDate() + 1);
    nextBackup.setHours(0, 0, 0, 0);

    return {
      lastBackup,
      nextScheduledBackup: nextBackup,
      backupHistory: backups,
      summary: {
        total: backups.length,
        successful: successfulBackups,
        failed: failedBackups,
      },
      storageLocation: "./prisma/backups/",
    };
  }
}

// ============================================================
// UTILITY: Format uptime seconds → readable string
// ============================================================
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
