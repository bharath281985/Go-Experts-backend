import { prisma } from "../../config/database.js";
import { getIo } from "../../socket/index.js";

export type NotificationPayload = {
  userId: string;
  role?: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  priority?: string;
  contextType?: string;
  contextId?: string;
  actorId?: string;
  actionUrl?: string;
};

export const emitNotification = async (payload: NotificationPayload) => {
  try {
    const channel = payload.channel || "in-app";
    const priority = payload.priority || "normal";

    // Atomic grouping: find existing unread, increment count, or create new
    const notification = await prisma.$transaction(async (tx) => {
      // Find an existing unread notification matching the strong grouping key
      // If actorId or contextId are missing, we still try to group them together.
      const existingUnread = await tx.notification.findFirst({
        where: {
          userId: payload.userId,
          type: payload.type,
          contextType: payload.contextType || null,
          contextId: payload.contextId || null,
          actorId: payload.actorId || null,
          readAt: null,
          status: { not: "deleted" },
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingUnread) {
        // Group it! Increment count and update message/timestamp
        let newMessage = payload.message;
        
        // Simple heuristic for message grouping text (can be extended)
        if (payload.type === "MESSAGE_SENT") {
          newMessage = `${existingUnread.count + 1} new messages`;
        } else if (payload.type === "PROPOSAL_SUBMITTED" && !payload.actorId) {
           newMessage = `${existingUnread.count + 1} freelancers submitted proposals`;
        }

        return await tx.notification.update({
          where: { id: existingUnread.id },
          data: {
            count: { increment: 1 },
            message: newMessage,
            createdAt: new Date(), // bump to top
          }
        });
      }

      // Create new
      return await tx.notification.create({
        data: {
          userId: payload.userId,
          role: payload.role || null,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          channel,
          priority,
          status: "delivered",
          contextType: payload.contextType || null,
          contextId: payload.contextId || null,
          actorId: payload.actorId || null,
          actionUrl: payload.actionUrl || null,
          count: 1,
        },
      });
    });

    const io = getIo();
    if (io) {
      // Emit to user's room
      io.to(payload.userId).emit("notification:new", {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        contextType: notification.contextType,
        contextId: notification.contextId,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt,
        count: notification.count,
        read: false,
      });
    }

    return notification;
  } catch (error) {
    console.error("Error emitting notification:", error);
    throw error;
  }
};
