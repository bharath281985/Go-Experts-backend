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
    // Columns may be missing before migration.
  }

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } }).catch(() => null);
  const me = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
  return prisma.conversation.create({
    data: {
      name: recipient?.fullName || me?.fullName || 'Chat',
      role: recipient?.role || role,
      status: 'active',
      avatar: recipient?.avatarUrl || null,
      msg: null,
      time: new Date().toISOString(),
      ...({
        userA: a,
        userB: b,
        projectId: projectId || null,
      } as any),
    },
  });
};

const resolveConversation = async (
  viewerId: string,
  viewerRole: string,
  conversationId?: string,
  recipientId?: string,
  projectId?: string
) => {
  if (conversationId) {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    }).catch(() => null);
    if (conv) return conv;
  }

  let targetId = recipientId || conversationId;
  if (!targetId) return null;

  let user = await prisma.user.findUnique({ where: { id: targetId } }).catch(() => null);
  if (!user) {
    const cp = await prisma.clientProfile.findUnique({ where: { id: targetId } }).catch(() => null);
    if (cp) user = await prisma.user.findUnique({ where: { id: cp.userId } }).catch(() => null);
  }
  if (!user) {
    const fp = await prisma.freelancerProfile.findUnique({ where: { id: targetId } }).catch(() => null);
    if (fp) user = await prisma.user.findUnique({ where: { id: fp.userId } }).catch(() => null);
  }

  if (user) {
    return findOrCreateDm(viewerId, viewerRole, user.id, projectId);
  }

  return null;
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
        include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
    } catch {
      conversations = await prisma.conversation.findMany({
        where: { status: 'active', deletedAt: null, role: req.user.role },
        include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
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

    // Filter out conversations that have no messages
    const validConversations = conversations.filter((c: any) => c.messages && c.messages.length > 0);

    // Compute unread count per conversation for the viewer
    const conversationIds = validConversations.map((c: any) => c.id);
    const unreadGroups = conversationIds.length > 0 ? await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        readAt: null,
        senderId: { not: req.user.id },
      },
      _count: { id: true },
    }).catch(() => []) : [];

    const unreadMap = new Map<string, number>();
    unreadGroups.forEach((g: any) => {
      unreadMap.set(g.conversationId, g._count?.id ?? 0);
    });

    const shapedConversations = validConversations.map((c: any) => {
      const otherId = c.userA === req.user.id ? c.userB : (c.userB === req.user.id ? c.userA : null);
      const otherUser = otherId ? userMap.get(otherId) : null;
      const lastMsg = (c.messages && c.messages[0]) ? c.messages[0] : null;

      let fallbackName = c.name;
      if (!fallbackName || fallbackName === 'Chat' || fallbackName === 'Conversation') {
        if (lastMsg && lastMsg.from && lastMsg.from !== 'me' && lastMsg.from !== req.user.fullName) {
          fallbackName = lastMsg.from;
        } else {
          fallbackName = otherUser ? otherUser.fullName : 'Unknown User';
        }
      }

      const lastText = lastMsg?.text || c.msg || '';
      const lastTime = lastMsg?.createdAt
        ? (typeof lastMsg.createdAt === 'string' ? lastMsg.createdAt : lastMsg.createdAt.toISOString())
        : (lastMsg?.time || (c.updatedAt ? c.updatedAt.toISOString() : c.createdAt?.toISOString()) || new Date().toISOString());

      const unreadCount = unreadMap.get(c.id) ?? (c.unread || 0);

      const result = {
        ...c,
        participantId: otherId,
        otherUserId: otherId,
        peerId: otherId,
        name: otherUser ? otherUser.fullName : fallbackName,
        avatar: otherUser ? otherUser.avatarUrl : (c.avatar || null),
        role: otherUser ? otherUser.role : c.role,
        msg: lastText,
        lastMessage: lastText,
        time: lastTime,
        lastMessageAt: lastTime,
        unread: unreadCount,
        unreadCount: unreadCount,
        _sortTime: new Date(lastTime).getTime(),
      };

      delete result.userA;
      delete result.userB;
      delete result.messages;

      return result;
    });

    // Sort by latest message descending so the most recent chat is at the top
    shapedConversations.sort((a: any, b: any) => (b._sortTime || 0) - (a._sortTime || 0));
    shapedConversations.forEach((c: any) => delete c._sortTime);

    return res.json(successResponse('Conversations retrieved', shapedConversations));
  } catch (error) {
    next(error);
  }
};

export const getConversation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversation = await resolveConversation(req.user.id, req.user.role, req.params.id);
    if (!conversation) {
      return res.json(successResponse('Messages retrieved', []));
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    // Mark conversation read for viewer.
    try {
      await prisma.message.updateMany({
        where: {
          conversationId: conversation.id,
          readAt: null,
          NOT: [
            { senderId: req.user.id },
            { from: 'me' },
            ...(req.user.fullName ? [{ from: req.user.fullName }] : []),
          ],
        },
        data: { readAt: new Date() },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { unread: 0 },
      });
    } catch {
      /* ignore */
    }
    const shaped = messages.map((m) => {
      const isMine =
        (m as any).senderId === req.user.id ||
        m.from === 'me' ||
        Boolean(req.user.fullName && m.from === req.user.fullName);
      return {
        ...m,
        conversationId: conversation.id,
        from: isMine ? 'me' : m.from,
        senderId: (m as any).senderId || (isMine ? req.user.id : null),
        isMine,
      };
    });
    return res.json(successResponse('Messages retrieved', shaped));
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId, text, recipientId, projectId, attachmentUrl } = req.body || {};
    const trimmedText = String(text || '').trim();

    // Find/create conversation without sending a placeholder message.
    if (!trimmedText && !attachmentUrl && (recipientId || conversationId)) {
      const conv = await resolveConversation(req.user.id, req.user.role, conversationId, recipientId, projectId);
      if (conv) {
        return res.status(200).json(
          successResponse('Conversation ready', {
            id: '',
            conversationId: conv.id,
            from: 'me',
            senderId: req.user.id,
            isMine: true,
            text: '',
            time: new Date().toISOString(),
          })
        );
      }
    }

    if (!trimmedText && !attachmentUrl) {
      return res.status(400).json(errorResponse('text is required', 'VALIDATION_ERROR'));
    }

    const conv = await resolveConversation(req.user.id, req.user.role, conversationId, recipientId, projectId);
    if (!conv) {
      return res
        .status(400)
        .json(errorResponse('conversationId or recipientId is required', 'VALIDATION_ERROR'));
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conv.id,
        from: 'me',
        text: trimmedText || (attachmentUrl ? '[Attachment]' : ''),
        time: new Date().toISOString(),
        ...({
          senderId: req.user.id,
          attachmentUrl: attachmentUrl || null,
        } as any),
      },
    });

    await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        msg: message.text,
        time: new Date().toISOString(),
        unread: { increment: 1 },
        updatedAt: new Date(),
      },
    }).catch(() => null);

    await notifyNewMessage(conv.id, {
      ...message,
      isMine: false,
      conversationId: conv.id,
      senderId: req.user.id,
    }).catch(() => null);

    return res.status(201).json(
      successResponse('Message sent', {
        ...message,
        conversationId: conv.id,
        from: 'me',
        senderId: req.user.id,
        isMine: true,
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
