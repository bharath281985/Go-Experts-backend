import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { HttpError } from "../../common/helpers/portal-shared.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

// Utility to grab the currently authenticated user's ID
function requireUser(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

export const listConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    // Fetch all conversations where user is userA or userB
    const convs = await prisma.conversation.findMany({
      where: {
        OR: [{ userA: userId }, { userB: userId }],
      },
      orderBy: { updatedAt: "desc" },
    });

    // Populate contact info for the *other* person dynamically
    // In a real app we might fetch user details, for now we map to the expected frontend shape
    const formatted = await Promise.all(convs.map(async (c: any) => {
      const otherId = c.userA === userId ? c.userB : c.userA;
      let otherUser = { fullName: "Unknown User", avatarUrl: null, headline: "User" };
      if (otherId) {
        const u = await prisma.user.findUnique({ where: { id: otherId } });
        if (u) {
          otherUser = {
            fullName: u.fullName || u.email || "Unknown",
            avatarUrl: u.avatarUrl,
            headline: u.role || "User",
          };
        }
      }
      return {
        id: c.id,
        name: otherUser.fullName,
        role: otherUser.headline,
        avatar: otherUser.avatarUrl,
        preview: c.msg || "No messages yet",
        lastMessageAt: c.updatedAt,
        unread: c.unread,
        online: c.online,
        otherUser: otherUser,
      };
    }));

    res.json({ success: true, rows: formatted, total: formatted.length });
  } catch (err) {
    next(err);
  }
};

export const getConversationMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "conversation id required" });

    // Validate access
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });
    if (conv.userA !== userId && conv.userB !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    const formatted = messages.map(m => ({
      id: m.id,
      from: m.senderId === userId ? "me" : "them",
      text: m.text,
      time: m.time,
      createdAt: m.createdAt,
      read: !!m.readAt,
      attachmentUrl: m.attachmentUrl,
    }));

    // Reset unread count
    await prisma.conversation.update({
      where: { id },
      data: { unread: 0 },
    });

    res.json({ success: true, rows: formatted, total: formatted.length });
  } catch (err) {
    next(err);
  }
};

export const createOrFindConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { recipientId, initialMessage, title } = req.body;
    if (!recipientId) return res.status(400).json({ success: false, message: "recipientId is required" });

    // See if one already exists
    let conv = await prisma.conversation.findFirst({
      where: {
        OR: [
          { userA: userId, userB: recipientId },
          { userA: recipientId, userB: userId },
        ],
      },
    });

    if (!conv) {
      // Create new
      conv = await prisma.conversation.create({
        data: {
          name: title || "Conversation",
          role: "User",
          userA: userId,
          userB: recipientId,
        },
      });
    }

    if (initialMessage) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: userId,
          from: userId,
          text: initialMessage,
          time: new Date().toISOString(),
        }
      });
      conv = await prisma.conversation.update({
        where: { id: conv.id },
        data: { msg: initialMessage, updatedAt: new Date() },
      });
    }

    res.status(201).json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};
