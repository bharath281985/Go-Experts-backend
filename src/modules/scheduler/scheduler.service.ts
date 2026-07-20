import { prisma } from "../../config/database.js";
import { CronExpressionParser } from "cron-parser";

export class SchedulerService {
  private static handlers = new Map<string, () => Promise<void>>();
  private static ticker: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  /**
   * Register a handler for a job name.
   */
  static registerHandler(name: string, handler: () => Promise<void>) {
    this.handlers.set(name, handler);
    console.log(`[SCHEDULER] Handler registered for: "${name}"`);
  }

  /**
   * Start the background scheduler execution loop (ticks every 30 seconds).
   */
  static startScheduler() {
    if (this.ticker) return;

    console.log("[SCHEDULER] Starting background job scheduler loop...");
    this.ticker = setInterval(() => this.tick(), 30000);
    // Trigger initial tick asynchronously
    this.tick().catch(err => console.error("[SCHEDULER] Error in initial tick:", err));
  }

  /**
   * Stop the background scheduler ticker.
   */
  static stopScheduler() {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
      console.log("[SCHEDULER] Stopped background job scheduler loop.");
    }
  }

  /**
   * Main ticker execution function.
   */
  private static async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();
      // Find all active scheduled jobs that are due
      const dueJobs = await prisma.scheduledJob.findMany({
        where: {
          status: "active",
          nextRun: { lte: now },
        },
      });

      for (const job of dueJobs) {
        await this.runJob(job.id);
      }
    } catch (error) {
      console.error("[SCHEDULER] Error during scheduler tick:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Run a job by database ID.
   */
  static async runJob(jobId: string): Promise<void> {
    const job = await prisma.scheduledJob.findUnique({ where: { id: jobId } });
    if (!job) {
      console.warn(`[SCHEDULER] Job not found: "${jobId}"`);
      return;
    }

    const handler = this.handlers.get(job.name);
    if (!handler) {
      const errMsg = `Handler not registered for job: "${job.name}"`;
      console.error(`[SCHEDULER] ${errMsg}`);
      await prisma.scheduledJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          errorMessage: errMsg,
        },
      });
      return;
    }

    const startTime = Date.now();
    let runStatus = "success";
    let errorMsg: string | null = null;

    try {
      console.log(`[SCHEDULER] Executing job: "${job.name}"`);
      await handler();
    } catch (error: any) {
      runStatus = "failed";
      errorMsg = error.message || String(error);
      console.error(`[SCHEDULER] Job "${job.name}" failed:`, error);
    }

    const duration = Date.now() - startTime;
    const nextRunTime = this.calculateNextRun(job.type, job.cronExpression, job.timezone);

    try {
      await prisma.$transaction(async (tx) => {
        // Log job execution details in history
        await tx.jobHistory.create({
          data: {
            jobId: job.id,
            status: runStatus,
            executionTime: duration,
            errorMessage: errorMsg,
          },
        });

        // Record execution in the general cron log
        await tx.cronExecution.create({
          data: {
            jobName: job.name,
            status: runStatus,
            executionTime: duration,
            errorMessage: errorMsg,
          },
        });

        // Update Job configuration status and next run time
        if (runStatus === "success") {
          await tx.scheduledJob.update({
            where: { id: job.id },
            data: {
              lastRun: new Date(),
              nextRun: nextRunTime,
              retryCount: 0,
              errorMessage: null,
              executionTime: duration,
            },
          });
        } else {
          const newRetryCount = job.retryCount + 1;
          const exceedsRetries = newRetryCount >= job.maxRetries;
          await tx.scheduledJob.update({
            where: { id: job.id },
            data: {
              lastRun: new Date(),
              nextRun: exceedsRetries ? null : new Date(Date.now() + 60000 * 5), // Retry in 5 minutes
              retryCount: newRetryCount,
              status: exceedsRetries ? "failed" : job.status,
              errorMessage: errorMsg,
              executionTime: duration,
            },
          });
        }
      });
    } catch (dbError) {
      console.error("[SCHEDULER] Failed to update execution results in DB:", dbError);
    }
  }

  /**
   * Pause a scheduled job.
   */
  static async pauseJob(id: string, updatedBy = "system") {
    const job = await prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) throw new Error("Job not found");

    const updated = await prisma.scheduledJob.update({
      where: { id },
      data: { status: "paused", updatedBy },
    });

    console.log(`[SCHEDULER] Job "${job.name}" has been paused by ${updatedBy}`);
    return updated;
  }

  /**
   * Resume a paused or failed job.
   */
  static async resumeJob(id: string, updatedBy = "system") {
    const job = await prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) throw new Error("Job not found");

    const nextRun = this.calculateNextRun(job.type, job.cronExpression, job.timezone);
    const updated = await prisma.scheduledJob.update({
      where: { id },
      data: { status: "active", nextRun, retryCount: 0, errorMessage: null, updatedBy },
    });

    console.log(`[SCHEDULER] Job "${job.name}" has been resumed by ${updatedBy}`);
    return updated;
  }

  /**
   * Cancel a scheduled job.
   */
  static async cancelJob(id: string, updatedBy = "system") {
    const job = await prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) throw new Error("Job not found");

    const updated = await prisma.scheduledJob.update({
      where: { id },
      data: { status: "cancelled", nextRun: null, updatedBy },
    });

    console.log(`[SCHEDULER] Job "${job.name}" has been cancelled by ${updatedBy}`);
    return updated;
  }

  /**
   * Run a job immediately.
   */
  static async runImmediately(id: string) {
    const job = await prisma.scheduledJob.findUnique({ where: { id } });
    if (!job) throw new Error("Job not found");

    // Execute runJob asynchronously in the background so it doesn't block the caller
    this.runJob(job.id).catch(err => {
      console.error(`[SCHEDULER] Error in immediate run of job "${job.name}":`, err);
    });
  }

  /**
   * Helper to parse cron expressions and calculate next execution time timezone-aware.
   */
  static calculateNextRun(type: string, cronExpression: string | null, timezone: string): Date | null {
    if (type === "one_time") return null;

    let expr = cronExpression;
    if (!expr) {
      // Map helper type keywords to expressions
      switch (type) {
        case "daily":
          expr = "0 0 * * *"; // Midnight daily
          expr = "0 0 * * *";
          break;
        case "weekly":
          expr = "0 0 * * 0"; // Midnight Sunday weekly
          break;
        case "monthly":
          expr = "0 0 1 * *"; // Midnight 1st of month monthly
          break;
        case "yearly":
          expr = "0 0 1 1 *"; // Midnight 1st of Jan yearly
          break;
        default:
          return null;
      }
    }

    try {
      const interval = CronExpressionParser.parse(expr, { tz: timezone });
      return interval.next().toDate();
    } catch (e) {
      console.error(`[SCHEDULER] Failed to parse cron expression "${expr}":`, e);
      return null;
    }
  }
}
