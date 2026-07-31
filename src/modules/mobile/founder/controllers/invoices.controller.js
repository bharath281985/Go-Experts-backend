import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const listInvoices = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({ where: { userId: req.user.id }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            prisma.invoice.count({ where: { userId: req.user.id } })
        ]);
        return res.json(successResponse('Invoices retrieved', invoices, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getInvoice = async (req, res, next) => {
    try {
        const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        return res.json(successResponse('Invoice details', invoice));
    }
    catch (error) {
        next(error);
    }
};
export const downloadInvoice = async (req, res, next) => {
    try {
        return res.json(successResponse('Invoice download link', { url: `/mock-downloads/invoice-${req.params.id}.pdf` }));
    }
    catch (error) {
        next(error);
    }
};
