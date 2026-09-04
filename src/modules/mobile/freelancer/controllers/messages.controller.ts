import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

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
      role,
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

export const listConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        OR: [{ userA: req.user.id }, { userB: req.user.id }],
      } as any,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      take: 20
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

    // Filter out conversations that have no messages
    const validConversations = conversations.filter((c: any) => c.messages && c.messages.length > 0);

    const shapedConversations = validConversations.map((c: any) => {
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

    return res.json(successResponse('Conversations retrieved', shapedConversations));
  } catch (error) { next(error); }
};

export const getConversationDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'asc' }
    });
    return res.json(successResponse('Messages retrieved', messages));
  } catch (error) { next(error); }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { conversationId, text, recipientId, projectId } = req.body || {};
    const trimmedText = String(text || '').trim();

    if (!trimmedText && !recipientId) {
      return res.status(400).json(errorResponse('conversationId or recipientId is required', 'VALIDATION_ERROR'));
    }

    let convId = conversationId as string | undefined;
    if (!convId && recipientId) {
      const conv = await findOrCreateDm(req.user.id, req.user.role, String(recipientId), projectId ? String(projectId) : undefined);
      convId = conv.id;
    }

    if (!convId) {
      return res.status(400).json(errorResponse('conversationId or recipientId is required', 'VALIDATION_ERROR'));
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        from: req.user.fullName || 'me',
        text: trimmedText || '',
        time: new Date().toISOString(),
        ...( { senderId: req.user.id } as any ),
      }
    });

    await prisma.conversation.update({
      where: { id: convId },
      data: {
        msg: message.text,
        time: new Date().toISOString(),
        unread: { increment: 1 },
      },
    }).catch(() => null);

    return res.status(201).json(successResponse('Message sent', { ...message, conversationId: convId, from: 'me', isMine: true }));
  } catch (error) { next(error); }
};

export const deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.message.delete({ where: { id: req.params.id } });
    return res.json(successResponse('Message deleted'));
  } catch (error) { next(error); }
};
