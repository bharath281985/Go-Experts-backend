import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { buildPublicFileUrl } from '../../../../utils/public-url.js';

export const listInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({ where: { userId: req.user.id }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.invoice.count({ where: { userId: req.user.id } }),
    ]);
    return res.json(successResponse('Invoices retrieved', invoices, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }));
  } catch (error) {
    next(error);
  }
};

export const getInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!invoice) return res.status(404).json(errorResponse('Invoice not found', 'NOT_FOUND'));
    return res.json(successResponse('Invoice details', invoice));
  } catch (error) {
    next(error);
  }
};

export const downloadInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!invoice) return res.status(404).json(errorResponse('Invoice not found', 'NOT_FOUND'));
    return res.json(successResponse('Invoice download link', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      url: buildPublicFileUrl(invoice.pdfPath, req),
      downloadAvailable: Boolean(invoice.pdfPath),
    }));
  } catch (error) {
    next(error);
  }
};