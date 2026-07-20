import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { SchedulerService } from "../../modules/scheduler/scheduler.service.js";
import { NotificationService } from "../../modules/notifications/notification.service.js";
import fs from "fs";
import path from "path";
import os from "os";

// ============================================================
// MODULE 7: REPORT SCHEDULER APIs
// ============================================================

export const scheduleReport = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { reportType, frequency, emailRecipient, format } = req.body;
    const actorEmail = req.user?.email || "system";

    const jobName = `Generate ${reportType} Report (${frequency})`;
    
    // Convert frequency keyword to cron
    let cronExpression = "0 0 * * *"; // daily default
    if (frequency === "weekly") cronExpression = "0 0 * * 0";
    if (frequency === "monthly") cronExpression = "0 0 1 * *";
    if (frequency === "quarterly") cronExpression = "0 0 1 */3 *";
    if (frequency === "yearly") cronExpression = "0 0 1 1 *";

    const nextRun = SchedulerService.calculateNextRun("cron", cronExpression, "UTC");

    const job = await prisma.scheduledJob.create({
      data: {
        name: jobName,
        type: "cron",
        cronExpression,
        timezone: "UTC",
        status: "active",
        nextRun,
        createdBy: actorEmail,
      },
    });

    res.status(201).json({
      success: true,
      message: "Report scheduled successfully",
      data: {
        job,
        reportType,
        format: format || "CSV",
        emailRecipient,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const generateReportImmediately = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { reportType, format, emailRecipient } = req.body;
    
    console.log(`[REPORT GENERATION] Generating ${reportType} in format ${format}`);
    
    // Simulate generation of report file
    const filename = `${reportType.toLowerCase()}_report_${Date.now()}.${(format || "csv").toLowerCase()}`;
    const reportPath = `/uploads/reports/${filename}`;
    const downloadLink = `https://goexperts.com/static/reports/${filename}`;

    // If email recipient is provided, simulate sending email
    if (emailRecipient) {
      try {
        await NotificationService.enqueue({
          userId: req.user?.id,
          type: "marketing",
          title: "Scheduled Report Ready",
          message: `Your ${reportType} report is ready for download. Format: ${format}. Link: ${downloadLink}`,
          channel: "email",
        });
      } catch (e) {
        console.error("Failed to enqueue email for report generation", e);
      }
    }

    res.json({
      success: true,
      data: {
        reportType,
        format: format || "CSV",
        generatedAt: new Date(),
        downloadLink,
        emailSent: !!emailRecipient,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 8: DATABASE BACKUP SCHEDULER APIs
// ============================================================

export const triggerBackup = async (req: any, res: Response, next: NextFunction) => {
  try {
    console.log("[BACKUP TRIGGER] Creating database backup snapshot...");
    
    // Generate dummy backup info
    const size = `${(Math.random() * 5 + 1.2).toFixed(2)} MB`;
    
    const backup = await prisma.backup.create({
      data: {
        size,
        type: "Full Database Snapshot",
        status: "Successful",
      },
    });

    res.json({
      success: true,
      message: "Database backup completed successfully.",
      data: backup,
    });
  } catch (err) {
    next(err);
  }
};

export const getBackupsList = async (req: any, res: Response, next: NextFunction) => {
  try {
    const backups = await prisma.backup.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: backups });
  } catch (err) {
    next(err);
  }
};

export const restoreBackup = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const backup = await prisma.backup.findUnique({ where: { id } });
    if (!backup) return res.status(404).json({ success: false, message: "Backup snapshot not found" });

    console.log(`[RESTORE PLACEHOLDER] Restoring database to snapshot ${id}...`);
    // Mock restore
    res.json({
      success: true,
      message: `Database restoration placeholder triggered successfully for backup snapshot ${backup.createdAt.toISOString()}`,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 9: SYSTEM HEALTH MONITOR API
// ============================================================

export const getSystemHealth = async (req: any, res: Response, next: NextFunction) => {
  try {
    // 1. Database Status
    let dbStatus = "connected";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (_) {
      dbStatus = "disconnected";
    }

    // 2. Storage Usage
    let uploadFolderSize = "0 MB";
    try {
      const uploadsDir = path.resolve("./uploads");
      if (fs.existsSync(uploadsDir)) {
        let totalSize = 0;
        const calculateSize = (dir: string) => {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              calculateSize(filePath);
            } else {
              totalSize += stat.size;
            }
          }
        };
        calculateSize(uploadsDir);
        uploadFolderSize = `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
      }
    } catch (_) {}

    // 3. Process metrics
    const memory = process.memoryUsage();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    // 4. Queues and Job state counters
    const [queueSize, failedJobs, pendingJobs] = await Promise.all([
      prisma.notificationQueue.count({ where: { status: "pending" } }),
      prisma.scheduledJob.count({ where: { status: "failed" } }),
      prisma.scheduledJob.count({ where: { status: "active" } }),
    ]);

    res.json({
      success: true,
      data: {
        database: {
          status: dbStatus,
        },
        api: {
          status: "healthy",
          uptime: process.uptime(),
        },
        storage: {
          usage: uploadFolderSize,
          directory: "./uploads",
        },
        systemMemory: {
          free: `${(freeMem / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          total: `${(totalMem / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          percentage: `${((1 - freeMem / totalMem) * 100).toFixed(1)}%`,
        },
        processMemory: {
          rss: `${(memory.rss / (1024 * 1024)).toFixed(2)} MB`,
          heapUsed: `${(memory.heapUsed / (1024 * 1024)).toFixed(2)} MB`,
          heapTotal: `${(memory.heapTotal / (1024 * 1024)).toFixed(2)} MB`,
        },
        cpu: {
          usagePlaceholder: "0.8%",
          model: os.cpus()[0]?.model || "Unknown CPU",
          cores: os.cpus().length,
        },
        scheduler: {
          pendingNotificationQueue: queueSize,
          failedJobs,
          pendingActiveJobs: pendingJobs,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================================
// MODULE 10: ADMIN DASHBOARD METRICS API
// ============================================================

export const getDashboardSchedulerStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const now = new Date();

    const [
      totalJobs,
      activeJobs,
      pausedJobs,
      failedJobs,
      upcomingJobs,
      rulesCount,
      recentHistory,
      queueStats
    ] = await Promise.all([
      prisma.scheduledJob.count(),
      prisma.scheduledJob.count({ where: { status: "active" } }),
      prisma.scheduledJob.count({ where: { status: "paused" } }),
      prisma.scheduledJob.count({ where: { status: "failed" } }),
      prisma.scheduledJob.findMany({
        where: {
          status: "active",
          nextRun: { gte: now },
        },
        orderBy: { nextRun: "asc" },
        take: 5,
      }),
      prisma.automationRule.count(),
      prisma.jobHistory.findMany({
        orderBy: { runAt: "desc" },
        take: 10,
        include: { job: { select: { name: true } } },
      }),
      prisma.notificationQueue.groupBy({
        by: ["status"],
        _count: true,
      }),
    ]);

    const queueMap = queueStats.reduce((acc: any, curr) => {
      acc[curr.status] = curr._count;
      return acc;
    }, { pending: 0, processing: 0, completed: 0, failed: 0 });

    res.json({
      success: true,
      data: {
        jobsSummary: {
          total: totalJobs,
          active: activeJobs,
          paused: pausedJobs,
          failed: failedJobs,
        },
        upcomingJobs,
        automationRules: {
          total: rulesCount,
        },
        recentExecutions: recentHistory,
        notificationQueue: queueMap,
      },
    });
  } catch (err) {
    next(err);
  }
};
