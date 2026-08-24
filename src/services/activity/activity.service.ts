import { prisma } from "../../config/database.js";
import { emitNotification } from "../notifications/notification-events.service.js";
import { evaluateReferral } from "../referral/qualification.service.js";

type ActorType = "USER" | "ADMIN" | "SYSTEM";

export interface LogEventParams {
  type: string;
  contextType?: string;
  contextId?: string;
  actorId?: string;
  actorType?: ActorType;
  metadata?: any;
  notify?: {
    userId: string;
    title: string;
    message: string;
    role?: string;
    priority?: string;
    actionUrl?: string;
  };
}

export const logActivityEvent = async (params: LogEventParams) => {
  try {
    const activity = await prisma.businessActivity.create({
      data: {
        type: params.type,
        contextType: params.contextType,
        contextId: params.contextId,
        actorId: params.actorId,
        actorType: params.actorType || "USER",
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });

    if (params.notify && params.notify.userId) {
      await emitNotification({
        userId: params.notify.userId,
        role: params.notify.role,
        type: params.type, // Grouping key
        title: params.notify.title,
        message: params.notify.message,
        contextType: params.contextType,
        contextId: params.contextId,
        actorId: params.actorId,
        priority: params.notify.priority || "normal",
        actionUrl: params.notify.actionUrl,
      });
    }

    // Trigger Referral Qualification Engine (Non-blocking)
    if (params.actorId && params.actorType === "USER") {
      Promise.resolve().then(() => 
        evaluateReferral(params.actorId!, params.type, {
          contextType: params.contextType,
          contextId: params.contextId,
          metadata: params.metadata
        })
      );
    }

    return activity;
  } catch (err) {
    console.error("Error logging activity event:", err);
    // Don't crash the calling flow for activity logging errors
    return null;
  }
};
