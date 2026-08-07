import { Response, NextFunction } from 'express';
import path from 'path';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
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
  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
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
    let conversations;
    try {
      conversations = await prisma.conversation.findMany({
        where: {
          status: 'active',
          deletedAt: null,
          OR: [{ userA: req.user.id }, { userB: req.user.id }],
        } as any,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        take: 50,
        orderBy: { updatedAt: 'desc' },
      });
    } catch {
      try {
        conversations = await prisma.conversation.findMany({
          where: { status: 'active' },
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
          take: 50,
        });
      } catch {
        conversations = [];
      }
    }
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

    return res.json(successResponse('Conversations retrieved', filteredConversations));
  } catch (error) {
    return res.json(successResponse('Conversations retrieved', []));
  }
};

export const getConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
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
    if ((!text || !String(text).trim()) && recipientId && !attachmentUrl) {
      const conv = await findOrCreateDm(req.user.id, req.user.role, recipientId, projectId);
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
    let convId = conversationId as string | undefined;
    if (!convId && recipientId) {
      const conv = await findOrCreateDm(req.user.id, req.user.role, recipientId, projectId);
      convId = conv.id;
    }
    if (!convId) {
      return res
        .status(400)
        .json(errorResponse('conversationId or recipientId is required', 'VALIDATION_ERROR'));
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
      data: { msg: message.text, time: new Date().toISOString() },
    });
    await notifyNewMessage(convId, {
      ...message,
      isMine: false,
      conversationId: convId,
      senderId: req.user.id,
    });
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
      /* column may be missing */
    }
    return res.json(successResponse('Message marked read'));
  } catch (error) {
    next(error);
  }
};

export const uploadAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }
    if (req.file.size > 10 * 1024 * 1024) {
      return res
        .status(400)
        .json(errorResponse('File too large. Maximum size is 10MB', 'FILE_TOO_LARGE'));
    }
    const url = uploadedFileUrl(req.file);
    return res.status(201).json(
      successResponse('Attachment uploaded', {
        url,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        filename: path.basename(req.file.filename),
      })
    );
  } catch (error) {
    next(error);
  }
};
