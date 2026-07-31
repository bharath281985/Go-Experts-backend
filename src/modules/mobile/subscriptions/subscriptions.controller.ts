import { Response, NextFunction } from 'express';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middlewares/auth.js';
import { initiatePaymentService } from '../payments/payments.service.js';

export const getPlans = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        status: 'active',
        role: req.user.role,
      },
    });
    return res.json(successResponse('Subscription plans retrieved', plans));
  } catch (error) {
    next(error);
  }
};

export const getCurrent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: 'active' },
      include: { plan: true },
    });
    return res.json(successResponse('Current subscription retrieved', subscription));
  } catch (error) {
    next(error);
  }
};

const startPlanPayment = async (req: AuthRequest, res: Response, action: string) => {
  const planId = req.body.planId || req.body.id;
  const gateway = (req.body.gateway as string) || 'easebuzz';
  if (!planId) {
    return res.status(400).json(errorResponse('planId is required', 'VALIDATION_ERROR'));
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return res.status(404).json(errorResponse('Plan not found', 'NOT_FOUND'));
  }
  const amount = Number(plan.amount ?? 0);
  if (!amount || amount <= 0) {
    return res.status(400).json(errorResponse('Plan has invalid price', 'VALIDATION_ERROR'));
  }
  const result = await initiatePaymentService(req.user.id, gateway, amount, 'INR', {
    planId,
    action,
    type: 'subscription',
  });
  return res.status(201).json(successResponse(`Subscription ${action} payment initiated`, result));
};

export const purchase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return await startPlanPayment(req, res, 'purchase');
  } catch (error) {
    next(error);
  }
};

export const renew = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return await startPlanPayment(req, res, 'renew');
  } catch (error) {
    next(error);
  }
};

export const upgrade = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return await startPlanPayment(req, res, 'upgrade');
  } catch (error) {
    next(error);
  }
};

export const cancel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.subscription.updateMany({
      where: { userId: req.user.id, status: 'active' },
      data: { status: 'cancelled', cancelledAt: new Date() } as any,
    });
    return res.json(successResponse('Subscription cancelled'));
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.subscriptionHistory.findMany({ where: { userId: req.user.id } });
    return res.json(successResponse('Subscription history retrieved', history));
  } catch (error) {
    next(error);
  }
};
