import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const listConversations = async (req, res, next) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: { status: 'active' },
            include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
            take: 20
        });
        return res.json(successResponse('Conversations retrieved', conversations));
    }
    catch (error) {
        next(error);
    }
};
export const getConversationDetails = async (req, res, next) => {
    try {
        const messages = await prisma.message.findMany({
            where: { conversationId: req.params.id },
            orderBy: { createdAt: 'asc' }
        });
        return res.json(successResponse('Messages retrieved', messages));
    }
    catch (error) {
        next(error);
    }
};
export const sendMessage = async (req, res, next) => {
    try {
        const { conversationId, text } = req.body;
        const message = await prisma.message.create({
            data: { conversationId, from: 'me', text, time: new Date().toISOString() }
        });
        return res.status(201).json(successResponse('Message sent', message));
    }
    catch (error) {
        next(error);
    }
};
export const deleteMessage = async (req, res, next) => {
    try {
        await prisma.message.delete({ where: { id: req.params.id } });
        return res.json(successResponse('Message deleted'));
    }
    catch (error) {
        next(error);
    }
};
