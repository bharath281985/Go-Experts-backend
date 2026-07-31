import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
export const listTickets = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const tickets = await prisma.supportTicket.findMany({ where: { user: req.user.id }, skip, take: limit, orderBy: { createdAt: 'desc' } });
        const total = await prisma.supportTicket.count({ where: { user: req.user.id } });
        return res.json(successResponse('Support tickets retrieved', tickets, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const createTicket = async (req, res, next) => {
    try {
        const { subject, category, priority } = req.body;
        const ticket = await prisma.supportTicket.create({ data: { subject, user: req.user.id, category, priority: priority || 'Medium', status: 'Open' } });
        return res.status(201).json(successResponse('Support ticket created', ticket));
    }
    catch (error) {
        next(error);
    }
};
export const getTicket = async (req, res, next) => {
    try {
        const ticket = await prisma.supportTicket.findFirst({ where: { id: req.params.id, user: req.user.id } });
        return res.json(successResponse('Ticket details', ticket));
    }
    catch (error) {
        next(error);
    }
};
export const replyToTicket = async (req, res, next) => {
    try {
        const { message, reply } = req.body;
        const text = String(message || reply || '').trim();
        if (!text) {
            return res.status(400).json(errorResponse('Reply message is required', 'VALIDATION_ERROR'));
        }
        const ticket = await prisma.supportTicket.findFirst({
            where: { id: req.params.id, user: req.user.id },
        });
        if (!ticket) {
            return res.status(404).json(errorResponse('Ticket not found', 'NOT_FOUND'));
        }
        const key = `support_replies:${ticket.id}`;
        const existing = await prisma.setting.findUnique({ where: { key } });
        const replies = existing?.value ? JSON.parse(existing.value) : [];
        replies.push({
            by: req.user.id,
            text,
            at: new Date().toISOString(),
        });
        await prisma.setting.upsert({
            where: { key },
            update: { value: JSON.stringify(replies), category: 'support' },
            create: { key, value: JSON.stringify(replies), category: 'support' },
        });
        return res.json(successResponse('Reply sent', { replies }));
    }
    catch (error) {
        next(error);
    }
};
export const closeTicket = async (req, res, next) => {
    try {
        await prisma.supportTicket.updateMany({ where: { id: req.params.id, user: req.user.id }, data: { status: 'Closed' } });
        return res.json(successResponse('Ticket closed'));
    }
    catch (error) {
        next(error);
    }
};
