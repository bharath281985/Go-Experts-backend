import { prisma } from "../../config/database.js";
import { SchedulerService } from "../../modules/scheduler/scheduler.service.js";
// ============================================================
// AUDIT LOGGING HELPER
// ============================================================
async function logSchedulerAction(params) {
    const { actorId, action, entity, entityId, description, oldValue, newValue } = params;
    // Create ActivityLog
    await prisma.activityLog.create({
        data: {
            adminUserId: actorId,
            action: `${action}_${entity}`.toUpperCase(),
            description,
        },
    });
    // Create AuditLog
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
// JOBS ADMIN API
// ============================================================
export const listJobs = async (req, res, next) => {
    try {
        const { status, type, page = "1", limit = "50" } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (type)
            where.type = type;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [jobs, total] = await Promise.all([
            prisma.scheduledJob.findMany({
                where, skip, take: parseInt(limit),
                orderBy: { name: "asc" },
            }),
            prisma.scheduledJob.count({ where }),
        ]);
        res.json({
            success: true,
            data: jobs,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const getJobDetails = async (req, res, next) => {
    try {
        const { id } = req.params;
        const job = await prisma.scheduledJob.findUnique({
            where: { id },
            include: {
                history: {
                    orderBy: { runAt: "desc" },
                    take: 50,
                },
            },
        });
        if (!job)
            return res.status(404).json({ success: false, message: "Job not found" });
        res.json({ success: true, data: job });
    }
    catch (err) {
        next(err);
    }
};
export const createJob = async (req, res, next) => {
    try {
        const { name, type, cronExpression, timezone, maxRetries } = req.body;
        const actorId = req.user?.id || "system";
        const actorEmail = req.user?.email || "system";
        const nextRun = SchedulerService.calculateNextRun(type, cronExpression, timezone || "UTC");
        const newJob = await prisma.scheduledJob.create({
            data: {
                name,
                type,
                cronExpression,
                timezone: timezone || "UTC",
                maxRetries: maxRetries || 3,
                status: "active",
                nextRun,
                createdBy: actorEmail,
            },
        });
        await logSchedulerAction({
            actorId,
            action: "create",
            entity: "scheduled_jobs",
            entityId: newJob.id,
            description: `Created scheduled job "${name}" of type ${type}`,
            newValue: newJob,
        });
        res.status(201).json({ success: true, data: newJob });
    }
    catch (err) {
        next(err);
    }
};
export const updateJob = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, type, cronExpression, timezone, maxRetries, status } = req.body;
        const actorId = req.user?.id || "system";
        const actorEmail = req.user?.email || "system";
        const oldJob = await prisma.scheduledJob.findUnique({ where: { id } });
        if (!oldJob)
            return res.status(404).json({ success: false, message: "Job not found" });
        // Calculate next run if cron expression, type, timezone or status changed
        let nextRun = oldJob.nextRun;
        if (type !== undefined || cronExpression !== undefined || timezone !== undefined || status === "active") {
            const targetType = type !== undefined ? type : oldJob.type;
            const targetCron = cronExpression !== undefined ? cronExpression : oldJob.cronExpression;
            const targetTz = timezone !== undefined ? timezone : oldJob.timezone;
            nextRun = SchedulerService.calculateNextRun(targetType, targetCron, targetTz);
        }
        const updatedJob = await prisma.scheduledJob.update({
            where: { id },
            data: {
                name,
                type,
                cronExpression,
                timezone,
                maxRetries,
                status,
                nextRun: status === "paused" || status === "cancelled" ? null : nextRun,
                updatedBy: actorEmail,
            },
        });
        await logSchedulerAction({
            actorId,
            action: "update",
            entity: "scheduled_jobs",
            entityId: id,
            description: `Updated scheduled job "${updatedJob.name}"`,
            oldValue: oldJob,
            newValue: updatedJob,
        });
        res.json({ success: true, data: updatedJob });
    }
    catch (err) {
        next(err);
    }
};
export const deleteJob = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id || "system";
        const oldJob = await prisma.scheduledJob.findUnique({ where: { id } });
        if (!oldJob)
            return res.status(404).json({ success: false, message: "Job not found" });
        await prisma.scheduledJob.delete({ where: { id } });
        await logSchedulerAction({
            actorId,
            action: "delete",
            entity: "scheduled_jobs",
            entityId: id,
            description: `Deleted scheduled job "${oldJob.name}"`,
            oldValue: oldJob,
        });
        res.json({ success: true, message: "Job successfully deleted" });
    }
    catch (err) {
        next(err);
    }
};
export const runJobImmediately = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id || "system";
        const job = await prisma.scheduledJob.findUnique({ where: { id } });
        if (!job)
            return res.status(404).json({ success: false, message: "Job not found" });
        await SchedulerService.runImmediately(id);
        await logSchedulerAction({
            actorId,
            action: "trigger",
            entity: "scheduled_jobs",
            entityId: id,
            description: `Triggered manual execution of job "${job.name}"`,
        });
        res.json({ success: true, message: `Job "${job.name}" triggered immediately in background.` });
    }
    catch (err) {
        next(err);
    }
};
export const pauseJob = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id || "system";
        const actorEmail = req.user?.email || "system";
        const oldJob = await prisma.scheduledJob.findUnique({ where: { id } });
        if (!oldJob)
            return res.status(404).json({ success: false, message: "Job not found" });
        const updated = await SchedulerService.pauseJob(id, actorEmail);
        await logSchedulerAction({
            actorId,
            action: "pause",
            entity: "scheduled_jobs",
            entityId: id,
            description: `Paused scheduled job "${oldJob.name}"`,
            oldValue: oldJob,
            newValue: updated,
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
};
export const resumeJob = async (req, res, next) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id || "system";
        const actorEmail = req.user?.email || "system";
        const oldJob = await prisma.scheduledJob.findUnique({ where: { id } });
        if (!oldJob)
            return res.status(404).json({ success: false, message: "Job not found" });
        const updated = await SchedulerService.resumeJob(id, actorEmail);
        await logSchedulerAction({
            actorId,
            action: "resume",
            entity: "scheduled_jobs",
            entityId: id,
            description: `Resumed scheduled job "${oldJob.name}"`,
            oldValue: oldJob,
            newValue: updated,
        });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        next(err);
    }
};
export const getJobHistory = async (req, res, next) => {
    try {
        const { jobId, status, page = "1", limit = "50" } = req.query;
        const where = {};
        if (jobId)
            where.jobId = jobId;
        if (status)
            where.status = status;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [history, total] = await Promise.all([
            prisma.jobHistory.findMany({
                where, skip, take: parseInt(limit),
                include: { job: { select: { name: true } } },
                orderBy: { runAt: "desc" },
            }),
            prisma.jobHistory.count({ where }),
        ]);
        res.json({
            success: true,
            data: history,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
