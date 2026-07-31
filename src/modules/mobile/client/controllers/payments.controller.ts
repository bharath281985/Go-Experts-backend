import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import {
  initiatePaymentService,
  verifyPaymentService,
} from '../../payments/payments.service.js';

export const listPayments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({ where: { userId: req.user.id }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.payment.count({ where: { userId: req.user.id } })
    ]);
    return res.json(successResponse('Payments retrieved', payments, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await prisma.payment.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!payment) return res.status(404).json(errorResponse('Payment not found', 'NOT_FOUND'));
    return res.json(successResponse('Payment details', payment));
  } catch (error) { next(error); }
};

export const initiatePayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { gateway = 'easebuzz', amount, currency, purpose, planId, metadata } = req.body;
    if (amount == null) {
      return res.status(422).json(errorResponse('amount is required', 'VALIDATION_ERROR'));
    }
    const payment = await initiatePaymentService(
      req.user.id,
      gateway || 'easebuzz',
      Number(amount),
      currency || 'INR',
      { purpose, planId, ...(metadata || {}) }
    );
    return res.json(successResponse('Payment initiated', payment));
  } catch (error: any) {
    if (error.message === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
      return res.status(400).json(errorResponse('Payment gateway is not configured', 'PAYMENT_GATEWAY_NOT_CONFIGURED'));
    }
    if (error.message === 'PAYMENT_GATEWAY_DISABLED' || error.message === 'INVALID_GATEWAY') {
      return res.status(400).json(errorResponse('Payment gateway unavailable', error.message));
    }
    next(error);
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentId, gateway = 'easebuzz', purpose, planId, ...verification } = req.body;
    if (!paymentId) {
      return res.status(422).json(errorResponse('paymentId is required', 'VALIDATION_ERROR'));
    }
    const result = await verifyPaymentService(req.user.id, paymentId, gateway, {
      ...verification,
      purpose,
      planId,
    });
    return res.json(successResponse('Payment verified', result));
  } catch (error: any) {
    if (error.message === 'PAYMENT_NOT_FOUND') {
      return res.status(404).json(errorResponse('Payment not found', 'NOT_FOUND'));
    }
    next(error);
  }
};

export const getPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, take: 50, orderBy: { createdAt: 'desc' } });
    return res.json(successResponse('Payment history', payments));
  } catch (error) { next(error); }
};
