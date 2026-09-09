import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { notifyNewMessage } from '../../../../utils/notify-message.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

const findOrCreateDm = async (userId: string, role: string, recipientId: string, projectId?: string | null) => {
  const [a, b] = [userId, recipientId].sort();

  const existing = await prisma.conversation.findFirst({
    where: {
      deletedAt: null,
      status: 'active',
      OR: [
        { userA: a, userB: b },
        { userA: b, userB: a },
      ],
    } as any,
  }).catch(() => null);

  if (existing) return existing;

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
      ...( {
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
  // 1. If conversationId is supplied, check if it's already a valid conversation
  if (conversationId) {
    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    }).catch(() => null);
    if (conv) return conv;
  }

  // 2. Otherwise, conversationId or recipientId might be a target user ID or profile ID
  let targetId = recipientId || conversationId;
  if (!targetId) return null;

  // Check if targetId is an existing user
  let user = await prisma.user.findUnique({ where: { id: targetId } }).catch(() => null);
  if (!user) {
    // Check if targetId is a clientProfile ID
    const cp = await prisma.clientProfile.findUnique({ where: { id: targetId } }).catch(() => null);
    if (cp) user = await prisma.user.findUnique({ where: { id: cp.userId } }).catch(() => null);
  }
  if (!user) {
    // Check if targetId is a freelancerProfile ID
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
    const conversations = await prisma.conversation.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        OR: [{ userA: req.user.id }, { userB: req.user.id }],
      } as any,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });

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

    // Compute unread count per conversation for the viewer
    const conversationIds = conversations.map((c: any) => c.id);
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

    const shapedConversations = conversations.map((c: any) => {
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

      const lastText = lastMsg?.text || c.msg || 'No messages yet';
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
  } catch (error) { next(error); }
};

export const getConversationDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conv = await resolveConversation(req.user.id, req.user.role, req.params.id);
    if (!conv) {
      return res.json(successResponse('Messages retrieved', []));
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' }
    });

    // Mark messages as read for this viewer
    await prisma.message.updateMany({
      where: {
        conversationId: conv.id,
        readAt: null,
        NOT: [
          { senderId: req.user.id },
          { from: 'me' },
          ...(req.user.fullName ? [{ from: req.user.fullName }] : []),
        ],
      },
      data: { readAt: new Date() },
    }).catch(() => null);

    await prisma.conversation.update({
      where: { id: conv.id },
      data: { unread: 0 },
    }).catch(() => null);

    const shaped = messages.map((m) => {
      const isMine =
        (m as any).senderId === req.user.id ||
        m.from === 'me' ||
        Boolean(req.user.fullName && m.from === req.user.fullName);
      return {
        ...m,
        conversationId: conv.id,
        from: isMine ? 'me' : m.from,
        senderId: (m as any).senderId || (isMine ? req.user.id : null),
        isMine,
      };
    });

    return res.json(successResponse('Messages retrieved', shaped));
  } catch (error) { next(error); }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId, text, recipientId, projectId, attachmentUrl } = req.body || {};
    const trimmedText = String(text || '').trim();

    // If empty text & no attachment, find/create conversation ready state
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
      return res.status(400).json(errorResponse('conversationId or recipientId is required', 'VALIDATION_ERROR'));
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
      }
    });

    const updatedConv = await prisma.conversation.update({
      where: { id: conv.id },
      data: {
        msg: message.text,
        time: new Date().toISOString(),
        unread: { increment: 1 },
        updatedAt: new Date(),
      },
    }).catch(() => null) as any;

    const payload = {
      ...message,
      conversationId: conv.id,
      from: message.from,
      senderId: req.user.id,
      isMine: false,
    };
    await notifyNewMessage(conv.id, payload).catch(() => null);

    try {
      const receiverId = updatedConv && updatedConv.userA === req.user.id ? updatedConv.userB : updatedConv?.userA;
      if (receiverId) {
        await NotificationEngine.queueNotification({
          userId: receiverId,
          type: 'new_message',
          title: `New message from ${req.user.fullName || 'User'}`,
          message: trimmedText ? (trimmedText.length > 50 ? trimmedText.substring(0, 50) + '...' : trimmedText) : 'Sent an attachment',
          channel: 'all',
          payload: {
            conversationId: conv.id,
            messageId: message.id,
          },
        });
      }
    } catch {
      /* ignore */
    }

    return res.status(201).json(
      successResponse('Message sent', {
        ...message,
        conversationId: conv.id,
        from: 'me',
        senderId: req.user.id,
        isMine: true,
      })
    );
  } catch (error) { next(error); }
};

export const deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.message.delete({ where: { id: req.params.id } });
    return res.json(successResponse('Message deleted'));
  } catch (error) { next(error); }
};

