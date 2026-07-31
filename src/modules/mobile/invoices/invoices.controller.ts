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

export const downloadInvoice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Invoice download link generated'));
  } catch (error) { next(error); }
};
