import { Response, NextFunction } from 'express';
import path from 'path';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { notifyNewMessage } from '../../../../utils/notify-message.js';

const BASE_URL = process.env.BASE_URL || 'https://mobileapi.goexperts.in';

const findOrCreateDm = async (
  userId: string,
  role: string,
  recipientId: string,
  projectId?: string | null
) => {
  const [a, b] = [userId, recipientId].sort();
  try {
    const existing = await prisma.conversation.findFirst({
      where: {
        deletedAt: null,
        status: 'active',
        OR: [
          { userA: a, userB: b },
          { userA: b, userB: a },
        ],
      } as any,
    });
    if (existing) return existing;
  } catch {
    /* pre-migration */
  }

  const recipient = recipientId ? await prisma.user.findUnique({ where: { id: recipientId } }) : null;
  return prisma.conversation.create({
    data: {
      name: recipient?.fullName || 'Chat',
      role,
      status: 'active',
      avatar: recipient?.avatarUrl || null,
      time: new Date().toISOString(),
      ...({
        userA: a,
        userB: b,
        projectId: projectId || null,
      } as any),
    },
  });
};

export const listConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    let where: any = {
      deletedAt: null,
      OR: [{ userA: req.user.id }, { userB: req.user.id }],
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.conversation.count({ where }),
    ]);

    const userIds = new Set<string>();
    conversations.forEach((c: any) => {
      if (c.userA && c.userA !== req.user.id) userIds.add(c.userA);
      if (c.userB && c.userB !== req.user.id) userIds.add(c.userB);
    });

    const userMap = new Map();
    if (userIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: Array.from(userIds) } },
        select: { id: true, fullName: true, avatarUrl: true, role: true }
      });
      users.forEach(u => userMap.set(u.id, u));
    }

    const shapedConversations = conversations.map((c: any) => {
      const otherId = c.userA === req.user.id ? c.userB : (c.userB === req.user.id ? c.userA : null);
      const otherUser = otherId ? userMap.get(otherId) : null;

      let fallbackName = c.name;
      if (!fallbackName || fallbackName === 'Chat') {
        const lastMsg = (c.messages && c.messages[0]) ? c.messages[0] : null;
        if (lastMsg && lastMsg.from && lastMsg.from !== 'me' && lastMsg.from !== req.user.fullName) {
          fallbackName = lastMsg.from;
        } else {
          fallbackName = 'Unknown User';
        }
      }

      const result = {
        ...c,
        name: otherUser ? otherUser.fullName : fallbackName,
        avatar: otherUser ? otherUser.avatarUrl : (c.avatar || null),
        role: otherUser ? otherUser.role : c.role
      };

      delete result.userA;
      delete result.userB;
      delete result.messages;

      return result;
    });

    // Filter out conversations that have no messages
    const filteredConversations = shapedConversations.filter((c: any) => c.messages && c.messages.length > 0);

    return res.json(
      successResponse('Conversations retrieved', filteredConversations, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

export const getConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!conversation) {
      return res.status(404).json(errorResponse('Conversation not found', 'NOT_FOUND'));
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    try {
      await prisma.conversation.update({
        where: { id: req.params.id },
        data: { unread: 0 },
      });
    } catch {
      /* ignore */
    }

    const shaped = messages.map((m) => ({
      ...m,
      from:
        (m as any).senderId === req.user.id ||
          m.from === 'me' ||
          m.from === req.user.fullName
          ? 'me'
          : m.from,
      isMine:
        (m as any).senderId === req.user.id ||
        m.from === 'me' ||
        m.from === req.user.fullName,
    }));

    return res.json(successResponse('Messages retrieved', shaped));
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId, text, recipientId, projectId, attachmentUrl } = req.body;
    let convId = conversationId as string | undefined;

    if (!convId && recipientId) {
      const conv = await findOrCreateDm(
        req.user.id,
        req.user.role,
        recipientId,
        projectId
      );
      convId = conv.id;
    }

    if (!convId) {
      return res
        .status(400)
        .json(errorResponse('Conversation ID or Recipient ID required', 'VALIDATION_ERROR'));
    }

    // Find/create conversation without sending a placeholder message.
    if ((!text || !String(text).trim()) && recipientId && !attachmentUrl) {
      const conv = await findOrCreateDm(
        req.user.id,
        req.user.role,
        recipientId,
        projectId
      );
      return res.status(200).json(
        successResponse('Conversation ready', {
          id: '',
          conversationId: conv.id,
          from: 'me',
          isMine: true,
          text: '',
          time: new Date().toISOString(),
        })
      );
    }

    if (!text && !attachmentUrl) {
      return res.status(400).json(errorResponse('text is required', 'VALIDATION_ERROR'));
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        from: req.user.fullName || 'me',
        text: text || (attachmentUrl ? '[Attachment]' : ''),
        time: new Date().toISOString(),
        ...({
          senderId: req.user.id,
          attachmentUrl: attachmentUrl || null,
        } as any),
      },
    });

    await prisma.conversation.update({
      where: { id: convId },
      data: { msg: message.text, time: new Date().toISOString(), updatedAt: new Date() },
    });

    const payload = {
      ...message,
      from: message.from,
      isMine: false,
      conversationId: convId,
      senderId: req.user.id,
    };
    await notifyNewMessage(convId, payload);

    return res.status(201).json(
      successResponse('Message sent', {
        ...message,
        from: 'me',
        isMine: true,
        conversationId: convId,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const markMessageRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    try {
      await prisma.message.update({
        where: { id: req.params.id },
        data: { readAt: new Date() } as any,
      });
    } catch {
      /* ignore */
    }
    return res.json(successResponse('Message marked read'));
  } catch (error) {
    next(error);
  }
};

export const markConversationRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { unread: 0 },
    });
    try {
      await prisma.message.updateMany({
        where: { conversationId: req.params.id },
        data: { readAt: new Date() } as any,
      });
    } catch {
      /* ignore */
    }
    return res.json(successResponse('Conversation marked read'));
  } catch (error) {
    next(error);
  }
};

export const markConversationUnread = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { unread: 1 },
    });
    return res.json(successResponse('Conversation marked unread'));
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message) {
      return res.status(404).json(errorResponse('Message not found', 'NOT_FOUND'));
    }
    const mine =
      (message as any).senderId === req.user.id ||
      message.from === 'me' ||
      message.from === req.user.fullName;
    if (!mine) {
      return res.status(403).json(errorResponse('Not allowed', 'FORBIDDEN'));
    }
    await prisma.message.delete({ where: { id: req.params.id } });
    return res.json(successResponse('Message deleted'));
  } catch (error) {
    next(error);
  }
};

export const deleteConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), status: 'deleted' },
    });
    return res.json(successResponse('Conversation deleted'));
  } catch (error) {
    next(error);
  }
};

export const uploadAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }
    if (file.size > 10 * 1024 * 1024) {
      return res
        .status(400)
        .json(errorResponse('File too large. Maximum size is 10MB', 'FILE_TOO_LARGE'));
    }
    const relativePath = file.path.replace(/\\/g, '/');
    const url = `${BASE_URL}/${relativePath}`;
    return res.status(201).json(
      successResponse('Attachment uploaded', {
        url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        filename: path.basename(file.filename),
      })
    );
  } catch (error) {
    next(error);
  }
};
