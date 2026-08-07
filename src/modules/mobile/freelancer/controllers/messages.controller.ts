import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

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
    const { conversationId, text } = req.body;
    const message = await prisma.message.create({
      data: { conversationId, from: 'me', text, time: new Date().toISOString() }
    });
    return res.status(201).json(successResponse('Message sent', message));
  } catch (error) { next(error); }
};

export const deleteMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.message.delete({ where: { id: req.params.id } });
    return res.json(successResponse('Message deleted'));
  } catch (error) { next(error); }
};
