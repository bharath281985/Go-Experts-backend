import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
export const getInvoices = async (req, res, next) => {
    try {
        const invoices = await prisma.invoice.findMany({ where: { userId: req.user.id } });
        return res.json(successResponse('Invoices retrieved', invoices));
    }
    catch (error) {
        next(error);
    }
};
export const getInvoice = async (req, res, next) => {
    try {
        const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
        return res.json(successResponse('Invoice retrieved', invoice));
    }
    catch (error) {
        next(error);
    }
};
export const downloadInvoice = async (req, res, next) => {
    try {
        return res.json(successResponse('Invoice download link generated'));
    }
    catch (error) {
        next(error);
    }
};
