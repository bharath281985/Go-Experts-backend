import { prisma } from "../../config/database.js";
import { NotificationService } from "../notifications/notification.service.js";

export class AutomationEngine {
  /**
   * Trigger an automation event.
   * @param event The event code (e.g. 'subscription_expired', 'project_inactive')
   * @param triggerEntityId The ID of the database entity triggering the event (e.g. subscription ID)
   * @param contextData Contextual variables for checking conditions and template rendering
   */
  static async trigger(event: string, triggerEntityId: string | null, contextData: Record<string, any>): Promise<void> {
    try {
      console.log(`[AUTOMATION] Triggering event "${event}" for entity "${triggerEntityId}"`);
      
      const rules = await prisma.automationRule.findMany({
        where: {
          event,
          status: "active",
        },
        orderBy: {
          priority: "desc",
        },
      });

      for (const rule of rules) {
        await this.evaluateAndExecuteRule(rule, triggerEntityId, contextData);
      }
    } catch (error) {
      console.error(`[AUTOMATION ERROR] Failed triggering event "${event}":`, error);
    }
  }

  /**
   * Evaluates conditions and runs actions if rule matches.
   */
  private static async evaluateAndExecuteRule(
    rule: any,
    triggerEntityId: string | null,
    contextData: Record<string, any>
  ): Promise<void> {
    let conditionsMet = false;
    let executionDetails: any = {};
    let errorMsg: string | null = null;
    let status = "skipped";

    try {
      let conditions: Record<string, any> = {};
      try {
        conditions = JSON.parse(rule.conditions || "{}");
      } catch (_) {
        conditions = {};
      }

      conditionsMet = this.evaluateConditions(conditions, contextData);
      executionDetails.conditionsEvaluated = conditions;
      executionDetails.context = contextData;
      executionDetails.conditionsMet = conditionsMet;

      if (conditionsMet) {
        status = "success";
        let actions: any[] = [];
        try {
          const parsed = JSON.parse(rule.actions || "[]");
          actions = Array.isArray(parsed) ? parsed : [parsed];
        } catch (_) {
          actions = [];
        }

        executionDetails.actionsExecuted = [];

        for (const action of actions) {
          const result = await this.executeAction(action, contextData);
          executionDetails.actionsExecuted.push({ action, result });
        }
      }
    } catch (err: any) {
      status = "failed";
      errorMsg = err.message || String(err);
      console.error(`[AUTOMATION ERROR] Rule "${rule.name}" failed:`, err);
    }

    // Log the execution
    if (conditionsMet || status === "failed") {
      try {
        await prisma.automationLog.create({
          data: {
            ruleId: rule.id,
            triggerEntityId,
            status,
            errorMessage: errorMsg,
            executionDetails: JSON.stringify(executionDetails),
          },
        });
      } catch (logError) {
        console.error("[AUTOMATION ERROR] Failed writing automation log:", logError);
      }
    }
  }

  /**
   * Helper to evaluate rule conditions against contextData.
   */
  private static evaluateConditions(conditions: Record<string, any>, contextData: Record<string, any>): boolean {
    for (const [key, expected] of Object.entries(conditions)) {
      const actual = contextData[key];

      if (expected && typeof expected === "object") {
        // Operators like gt, gte, lt, lte, eq, contains
        if ("gt" in expected && !(actual > expected.gt)) return false;
        if ("gte" in expected && !(actual >= expected.gte)) return false;
        if ("lt" in expected && !(actual < expected.lt)) return false;
        if ("lte" in expected && !(actual <= expected.lte)) return false;
        if ("eq" in expected && actual !== expected.eq) return false;
        if ("neq" in expected && actual === expected.neq) return false;
        if ("contains" in expected) {
          if (!actual || !String(actual).toLowerCase().includes(String(expected.contains).toLowerCase())) {
            return false;
          }
        }
      } else {
        // Strict match
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  /**
   * Helper to execute a single automation action.
   */
  private static async executeAction(action: any, contextData: Record<string, any>): Promise<any> {
    const actionType = action.type;

    if (actionType === "notify" || actionType === "notification") {
      // Resolve recipient from context
      let recipientId = action.recipientId;
      if (typeof recipientId === "string" && recipientId.startsWith("{{") && recipientId.endsWith("}}")) {
        const key = recipientId.slice(2, -2).trim();
        recipientId = contextData[key];
      }

      if (!recipientId) {
        throw new Error("Automation action missing recipientId or could not resolve it from context.");
      }

      // Interpolate any dynamic variables in parameters
      const variables: Record<string, any> = {};
      if (action.variables && typeof action.variables === "object") {
        for (const [vKey, vVal] of Object.entries(action.variables)) {
          if (typeof vVal === "string" && vVal.startsWith("{{") && vVal.endsWith("}}")) {
            const key = vVal.slice(2, -2).trim();
            variables[vKey] = contextData[key] !== undefined ? contextData[key] : "";
          } else {
            variables[vKey] = vVal;
          }
        }
      }

      // Enqueue the notification via the NotificationService
      const templateCode = action.templateCode;
      const channel = action.channel || "in_app";
      const priority = action.priority || "normal";
      const title = action.title;
      const message = action.message;

      const enqueued = await NotificationService.enqueue({
        userId: recipientId,
        type: action.category || "system",
        templateCode,
        title,
        message,
        channel,
        priority,
        variables,
      });

      return { status: "enqueued", count: enqueued.length };
    }

    throw new Error(`Unsupported automation action type: "${actionType}"`);
  }
}
