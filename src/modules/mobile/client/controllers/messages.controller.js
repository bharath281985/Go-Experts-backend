import path from 'path';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { notifyNewMessage } from '../../../../utils/notify-message.js';
const BASE_URL = process.env.BASE_URL || 'https://mobileapi.goexperts.in';
const findOrCreateDm = async (userId, role, recipientId, projectId) => {
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
            },
        });
        if (existing)
            return existing;
    }
    catch {
        // Columns may be missing before migration.
    }
    const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
    const me = await prisma.user.findUnique({ where: { id: userId } });
    return prisma.conversation.create({
        data: {
            name: recipient?.fullName || me?.fullName || 'Chat',
            role,
            status: 'active',
            avatar: recipient?.avatarUrl || null,
            msg: null,
            time: new Date().toISOString(),
            ...{
                userA: a,
                userB: b,
                projectId: projectId || null,
            },
        },
    });
};
export const listConversations = async (req, res, next) => {
    try {
        let conversations;
        try {
            conversations = await prisma.conversation.findMany({
                where: {
                    status: 'active',
                    deletedAt: null,
                    OR: [{ userA: req.user.id }, { userB: req.user.id }, { role: req.user.role }],
                },
                include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
                orderBy: { updatedAt: 'desc' },
                take: 50,
            });
        }
        catch {
            conversations = await prisma.conversation.findMany({
                where: { status: 'active', deletedAt: null, role: req.user.role },
                include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
                orderBy: { updatedAt: 'desc' },
                take: 50,
            });
        }
        return res.json(successResponse('Conversations retrieved', conversations));
    }
    catch (error) {
        next(error);
    }
};
export const getConversation = async (req, res, next) => {
    try {
        const messages = await prisma.message.findMany({
            where: { conversationId: req.params.id },
            orderBy: { createdAt: 'asc' },
        });
        // Mark conversation read for viewer.
        try {
            await prisma.conversation.update({
                where: { id: req.params.id },
                data: { unread: 0 },
            });
        }
        catch {
            /* ignore */
        }
        const shaped = messages.map((m) => ({
            ...m,
            from: m.senderId === req.user.id || m.from === 'me' || m.from === req.user.fullName
                ? 'me'
                : m.from,
            isMine: m.senderId === req.user.id || m.from === 'me' || m.from === req.user.fullName,
        }));
        return res.json(successResponse('Messages retrieved', shaped));
    }
    catch (error) {
        next(error);
    }
};
export const sendMessage = async (req, res, next) => {
    try {
        const { conversationId, text, recipientId, projectId, attachmentUrl } = req.body;
        // Find/create conversation without sending a placeholder message.
        if ((!text || !String(text).trim()) && recipientId && !attachmentUrl) {
            const conv = await findOrCreateDm(req.user.id, req.user.role, recipientId, projectId);
            return res.status(200).json(successResponse('Conversation ready', {
                id: '',
                conversationId: conv.id,
                from: 'me',
                isMine: true,
                text: '',
                time: new Date().toISOString(),
            }));
        }
        if (!text && !attachmentUrl) {
            return res.status(400).json(errorResponse('text is required', 'VALIDATION_ERROR'));
        }
        let convId = conversationId;
        if (!convId && recipientId) {
            const conv = await findOrCreateDm(req.user.id, req.user.role, recipientId, projectId);
            convId = conv.id;
        }
        if (!convId) {
            return res
                .status(400)
                .json(errorResponse('conversationId or recipientId is required', 'VALIDATION_ERROR'));
        }
        // If the provided conversationId doesn't exist (Flutter may send a user ID by mistake),
        // treat it as a recipientId and find/create the real DM conversation.
        const convExists = await prisma.conversation.findUnique({ where: { id: convId } }).catch(() => null);
        if (!convExists) {
            // convId is likely a user/freelancer ID sent by the app — treat as recipientId
            const conv = await findOrCreateDm(req.user.id, req.user.role, convId, projectId);
            convId = conv.id;
        }
        let message;
        try {
            message = await prisma.message.create({
                data: {
                    conversationId: convId,
                    from: req.user.fullName || 'me',
                    text: text || (attachmentUrl ? '[Attachment]' : ''),
                    time: new Date().toISOString(),
                    senderId: req.user.id,
                    attachmentUrl: attachmentUrl || null,
                },
            });
        }
        catch (createErr) {
            // P2003: FK constraint — fall back to raw SQL insert
            if (createErr?.code === 'P2003' || createErr?.message?.includes('Foreign key constraint')) {
                const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const msgText = text || (attachmentUrl ? '[Attachment]' : '');
                const msgTime = new Date().toISOString();
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Message" (id, "conversationId", "senderId", "from", text, time, "attachmentUrl", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
                    msgId, convId, req.user.id, req.user.fullName || 'me', msgText, msgTime, attachmentUrl || null
                );
                message = { id: msgId, conversationId: convId, senderId: req.user.id, from: req.user.fullName || 'me', text: msgText, time: msgTime, attachmentUrl: attachmentUrl || null, createdAt: new Date(), updatedAt: new Date() };
            } else {
                throw createErr;
            }
        }
        try {
            await prisma.conversation.update({
                where: { id: convId },
                data: {
                    msg: message.text,
                    time: new Date().toISOString(),
                    unread: { increment: 1 },
                },
            });
        }
        catch { /* ignore conversation update errors */ }
        await notifyNewMessage(convId, {
            ...message,
            isMine: false,
            conversationId: convId,
            senderId: req.user.id,
        });
        return res.status(201).json(successResponse('Message sent', {
            ...message,
            from: 'me',
            isMine: true,
            conversationId: convId,
        }));
    }
    catch (error) {
        next(error);
    }
};
export const markMessageRead = async (req, res, next) => {
    try {
        try {
            await prisma.message.update({
                where: { id: req.params.id },
                data: { readAt: new Date() },
            });
        }
        catch {
            /* column may be missing */
        }
        return res.json(successResponse('Message marked read'));
    }
    catch (error) {
        next(error);
    }
};
export const markConversationRead = async (req, res, next) => {
    try {
        await prisma.conversation.update({
            where: { id: req.params.id },
            data: { unread: 0 },
        });
        try {
            await prisma.message.updateMany({
                where: { conversationId: req.params.id },
                data: { readAt: new Date() },
            });
        }
        catch {
            /* ignore */
        }
        return res.json(successResponse('Conversation marked read'));
    }
    catch (error) {
        next(error);
    }
};
export const markConversationUnread = async (req, res, next) => {
    try {
        await prisma.conversation.update({
            where: { id: req.params.id },
            data: { unread: 1 },
        });
        return res.json(successResponse('Conversation marked unread'));
    }
    catch (error) {
        next(error);
    }
};
export const deleteMessage = async (req, res, next) => {
    try {
        const message = await prisma.message.findUnique({ where: { id: req.params.id } });
        if (!message) {
            return res.status(404).json(errorResponse('Message not found', 'NOT_FOUND'));
        }
        const mine = message.senderId === req.user.id ||
            message.from === 'me' ||
            message.from === req.user.fullName;
        if (!mine) {
            return res.status(403).json(errorResponse('Not allowed', 'FORBIDDEN'));
        }
        await prisma.message.delete({ where: { id: req.params.id } });
        return res.json(successResponse('Message deleted'));
    }
    catch (error) {
        next(error);
    }
};
export const deleteConversation = async (req, res, next) => {
    try {
        await prisma.conversation.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date(), status: 'deleted' },
        });
        return res.json(successResponse('Conversation deleted'));
    }
    catch (error) {
        next(error);
    }
};
export const uploadAttachment = async (req, res, next) => {
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
        return res.status(201).json(successResponse('Attachment uploaded', {
            url,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            filename: path.basename(file.filename),
        }));
    }
    catch (error) {
        next(error);
    }
};
