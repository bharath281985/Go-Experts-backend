import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { canCreateConversation, ConversationContextType } from "../../common/helpers/conversation-permissions.js";
import { emitNotification } from "../../services/notifications/notification-events.service.js";

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
    
    const { contextType } = req.query;

    const whereClause: any = {
      OR: [{ userA: userId }, { userB: userId }],
    };
    
    // Admins can see all support tickets
    if (req.user?.role === "admin" && contextType === "SUPPORT") {
      delete whereClause.OR;
      whereClause.contextType = "SUPPORT";
    }

    if (contextType) {
      whereClause.contextType = String(contextType);
    }

    const convs = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        project: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

        const states = await prisma.conversationState.findMany({ where: { userId, conversationId: { in: convs.map(c => c.id) } } });
    const stateMap = states.reduce((acc, s) => { acc[s.conversationId] = s; return acc; }, {} as Record<string, any>);

    const formatted = await Promise.all(convs.map(async (c: any) => {
      const state = stateMap[c.id] || { isPinned: false, isMuted: false, isArchived: false };
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
      
      let convTitle = (c.name && c.name !== "Conversation") ? c.name : otherUser.fullName;
      // if (c.contextType === "PROJECT" && c.project) convTitle = c.project.title; // Keep client name instead
      if (c.contextType === "SUPPORT") convTitle = `Support: ${c.name}`;

      return {
        id: c.id,
        name: convTitle,
        contextType: c.contextType,
        projectId: c.projectId,
        investmentId: c.investmentId,
        startupIdeaId: c.startupIdeaId,
        supportTicketId: c.supportTicketId,
        project: c.project,
        role: otherUser.headline,
        avatar: otherUser.avatarUrl,
        preview: c.msg || "No messages yet",
        lastMessageAt: c.updatedAt,
        unread: c.unread,
        online: c.online,
        status: c.status,
        otherUser: otherUser,
        isPinned: state.isPinned,
        isMuted: state.isMuted,
        isArchived: state.isArchived,
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

    const conv = await prisma.conversation.findUnique({ 
      where: { id },
      include: { 
        project: { select: { id: true, title: true, client: true } },
      }
    });
    
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });
    
    if (conv.userA !== userId && conv.userB !== userId && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    const formatted = messages.map(m => ({
        id: m.id,
        clientMessageId: m.clientMessageId,
        senderId: m.senderId,
        from: m.senderId === userId ? "me" : (m.from === "System" ? "system" : "them"),
        text: m.text,
        time: m.time,
        createdAt: m.createdAt,
        read: !!m.readAt,
        attachmentUrl: m.attachmentUrl,
      }));

    if (conv.userA === userId || conv.userB === userId) {
      await prisma.conversation.update({
        where: { id },
        data: { unread: 0 },
      });
    }

    res.json({ 
      success: true, 
      rows: formatted, 
      total: formatted.length,
      conversation: {
        id: conv.id,
        contextType: conv.contextType,
        projectId: conv.projectId,
        project: conv.project,
        startupIdeaId: conv.startupIdeaId,
        status: conv.status
      }
    });
  } catch (err) {
    next(err);
  }
};

export const createOrFindConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const userRole = req.user?.role || "client";

    const { 
      recipientId, 
      initialMessage, 
      title, 
      contextType, 
      projectId, 
      investmentId, 
      startupIdeaId, 
      supportTicketId 
    } = req.body;
    
    if (!recipientId && contextType !== "SUPPORT") {
      return res.status(400).json({ success: false, message: "recipientId is required" });
    }

    let targetUser = recipientId ? await prisma.user.findUnique({ where: { id: recipientId } }) : null;
    let targetRole = targetUser?.role || "admin"; 

    let actualContextId = projectId || investmentId || startupIdeaId || supportTicketId;
    
    const isAuthorized = canCreateConversation(userRole, targetRole, contextType, actualContextId);
    if (!isAuthorized && contextType !== "SUPPORT") {
       return res.status(403).json({ success: false, message: "Not authorized to create a conversation with this context." });
    }

    let finalRecipientId = recipientId;
    if (contextType === "SUPPORT" && !recipientId) {
       const admin = await prisma.user.findFirst({ where: { role: "admin" } });
       if (admin) finalRecipientId = admin.id;
    }

    const whereConditions: any = {
      contextType,
    };
    if (projectId) whereConditions.projectId = projectId;
    if (investmentId) whereConditions.investmentId = investmentId;
    if (startupIdeaId) whereConditions.startupIdeaId = startupIdeaId;
    if (supportTicketId) whereConditions.supportTicketId = supportTicketId;

    if (finalRecipientId) {
      whereConditions.OR = [
        { userA: userId, userB: finalRecipientId },
        { userA: finalRecipientId, userB: userId },
      ];
    } else {
      whereConditions.userA = userId;
    }

    let conv = await prisma.conversation.findFirst({
      where: whereConditions,
    });

    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          name: title || "Conversation",
          role: contextType || "Context",
          userA: userId,
          userB: finalRecipientId,
          contextType: contextType,
          projectId: projectId || null,
          investmentId: investmentId || null,
          startupIdeaId: startupIdeaId || null,
          supportTicketId: supportTicketId || null
        },
      });
    }

    if (initialMessage && finalRecipientId) {
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
        data: { msg: initialMessage, updatedAt: new Date(), unread: { increment: 1 } },
      });

      await emitNotification({
         userId: finalRecipientId,
         type: "MESSAGE_RECEIVED",
         title: "New Message",
         message: initialMessage.length > 50 ? initialMessage.substring(0, 50) + "..." : initialMessage,
         contextType: contextType,
         contextId: actualContextId,
         actionUrl: "/business/messages?conv=" + conv.id
      });
    }

    res.status(201).json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const updateConversationStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { status } = req.body;

    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

    if (conv.userA !== userId && conv.userB !== userId && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (status === "BLOCKED" && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can block conversations" });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, conversation: updated });
  } catch (err) {
    next(err);
  }
};

export const addAdminNote = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { id } = req.params;
    const { note } = req.body;

    await prisma.conversation.update({
      where: { id },
      data: { adminNote: note }
    });

    res.json({ success: true, message: "Note added" });
  } catch (err) {
    next(err);
  }
};

export const updateConversationState = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { isPinned, isMuted, isArchived } = req.body;

    const state = await prisma.conversationState.upsert({
      where: { userId_conversationId: { userId, conversationId: id } },
      update: {
        isPinned: isPinned !== undefined ? isPinned : undefined,
        isMuted: isMuted !== undefined ? isMuted : undefined,
        isArchived: isArchived !== undefined ? isArchived : undefined,
      },
      create: {
        userId,
        conversationId: id,
        isPinned: isPinned || false,
        isMuted: isMuted || false,
        isArchived: isArchived || false,
      }
    });

    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};
