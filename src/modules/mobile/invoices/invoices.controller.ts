import { Response, NextFunction } from 'express';
import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middlewares/auth.js';

export const getInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoices = await prisma.invoice.findMany({ where: { userId: req.user.id } });
    return res.json(successResponse('Invoices retrieved', invoices));
  } catch (error) { next(error); }
};

export const getInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    return res.json(successResponse('Invoice retrieved', invoice));
  } catch (error) { next(error); }
};

import { generateInvoicePdf } from '../../../services/invoice/invoice.service.js';

export const downloadInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    // Verify ownership
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) return res.status(404).json({ success: false, message: 'Invoice not found' });
    if (inv.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { publicPath } = await generateInvoicePdf(id) as any;
    const base = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
    return res.json(successResponse('Invoice download link generated', { url: `${base}${publicPath}` }));
  } catch (error) { next(error); }
};
