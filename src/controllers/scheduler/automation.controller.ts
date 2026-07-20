import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";

// ============================================================
// AUDIT LOGGING HELPER
// ============================================================
async function logAutomationAction(params: {
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}) {
  const { actorId, action, entity, entityId, description, oldValue, newValue } = params;

  await prisma.activityLog.create({
    data: {
      adminUserId: actorId,
      action: `${action}_${entity}`.toUpperCase(),
      description,
    },
  });

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
// AUTOMATION RULES ADMIN API
// ============================================================

export const listRules = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { status, event, page = "1", limit = "50" } = req.query;
    const where: any = {};
    if (status) where.status = status;
    if (event) where.event = event;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [rules, total] = await Promise.all([
      prisma.automationRule.findMany({
        where, skip, take: parseInt(limit as string),
        orderBy: { priority: "desc" },
      }),
      prisma.automationRule.count({ where }),
    ]);

    res.json({
      success: true,
      data: rules,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getRuleDetails = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const rule = await prisma.automationRule.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
    if (!rule) return res.status(404).json({ success: false, message: "Rule not found" });
    res.json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};

export const createRule = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { name, event, conditions, actions, priority, status } = req.body;
    const actorId = req.user?.id || "system";
    const actorEmail = req.user?.email || "system";

    const rule = await prisma.automationRule.create({
      data: {
        name,
        event,
        conditions: typeof conditions === "object" ? JSON.stringify(conditions) : conditions || "{}",
        actions: typeof actions === "object" ? JSON.stringify(actions) : actions || "[]",
        priority: priority || 0,
        status: status || "active",
        createdBy: actorEmail,
      },
    });

    await logAutomationAction({
      actorId,
      action: "create",
      entity: "automation_rules",
      entityId: rule.id,
      description: `Created automation rule "${name}" triggered on event "${event}"`,
      newValue: rule,
    });

    res.status(201).json({ success: true, data: rule });
  } catch (err) {
    next(err);
  }
};

export const updateRule = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, event, conditions, actions, priority, status } = req.body;
    const actorId = req.user?.id || "system";
    const actorEmail = req.user?.email || "system";

    const oldRule = await prisma.automationRule.findUnique({ where: { id } });
    if (!oldRule) return res.status(404).json({ success: false, message: "Rule not found" });

    const updatedRule = await prisma.automationRule.update({
      where: { id },
      data: {
        name,
        event,
        conditions: typeof conditions === "object" ? JSON.stringify(conditions) : conditions,
        actions: typeof actions === "object" ? JSON.stringify(actions) : actions,
        priority,
        status,
        updatedBy: actorEmail,
      },
    });

    await logAutomationAction({
      actorId,
      action: "update",
      entity: "automation_rules",
      entityId: id,
      description: `Updated automation rule "${updatedRule.name}"`,
      oldValue: oldRule,
      newValue: updatedRule,
    });

    res.json({ success: true, data: updatedRule });
  } catch (err) {
    next(err);
  }
};

export const deleteRule = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.id || "system";

    const oldRule = await prisma.automationRule.findUnique({ where: { id } });
    if (!oldRule) return res.status(404).json({ success: false, message: "Rule not found" });

    await prisma.automationRule.delete({ where: { id } });

    await logAutomationAction({
      actorId,
      action: "delete",
      entity: "automation_rules",
      entityId: id,
      description: `Deleted automation rule "${oldRule.name}"`,
      oldValue: oldRule,
    });

    res.json({ success: true, message: "Rule successfully deleted" });
  } catch (err) {
    next(err);
  }
};

export const toggleRule = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // active or inactive
    const actorId = req.user?.id || "system";
    const actorEmail = req.user?.email || "system";

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be active or inactive" });
    }

    const oldRule = await prisma.automationRule.findUnique({ where: { id } });
    if (!oldRule) return res.status(404).json({ success: false, message: "Rule not found" });

    const updated = await prisma.automationRule.update({
      where: { id },
      data: { status, updatedBy: actorEmail },
    });

    await logAutomationAction({
      actorId,
      action: status === "active" ? "enable" : "disable",
      entity: "automation_rules",
      entityId: id,
      description: `${status === "active" ? "Enabled" : "Disabled"} automation rule "${oldRule.name}"`,
      oldValue: oldRule,
      newValue: updated,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

export const getAutomationLogs = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { ruleId, status, page = "1", limit = "50" } = req.query;
    const where: any = {};
    if (ruleId) where.ruleId = ruleId;
    if (status) where.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [logs, total] = await Promise.all([
      prisma.automationLog.findMany({
        where, skip, take: parseInt(limit as string),
        include: { rule: { select: { name: true, event: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.automationLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    next(err);
  }
};
