import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { status: 'active' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      take: 20
    });
    return res.json(successResponse('Conversations retrieved', conversations));
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
