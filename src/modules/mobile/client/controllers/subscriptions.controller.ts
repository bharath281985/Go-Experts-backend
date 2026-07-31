import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { initiatePaymentService } from '../../payments/payments.service.js';

export const getCurrentPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user.id, status: 'active' },
      include: { plan: true },
    });
    return res.json(successResponse('Current plan', subscription));
  } catch (error) { next(error); }
};

export const getPlans = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { status: 'active', role: req.user.role },
    });
    return res.json(successResponse('Plans', plans));
  } catch (error) { next(error); }
};

export const getAvailablePlans = getPlans;

const pay = async (req: AuthRequest, res: Response, action: string) => {
  const planId = req.body.planId || req.body.id;
  const gateway = req.body.gateway || 'easebuzz';
  if (!planId) return res.status(400).json(errorResponse('planId is required', 'VALIDATION_ERROR'));
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return res.status(404).json(errorResponse('Plan not found', 'NOT_FOUND'));
  const amount = Number(plan.amount ?? 0);
  if (!amount) return res.status(400).json(errorResponse('Invalid plan price', 'VALIDATION_ERROR'));
  const result = await initiatePaymentService(req.user.id, gateway, amount, 'INR', {
    planId, action, type: 'subscription',
  });
  return res.status(201).json(successResponse(`Subscription ${action} initiated`, result));
};

export const purchasePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return await pay(req, res, 'purchase'); } catch (e) { next(e); }
};
export const renewPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return await pay(req, res, 'renew'); } catch (e) { next(e); }
};
export const upgradePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return await pay(req, res, 'upgrade'); } catch (e) { next(e); }
};
export const cancelPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.subscription.updateMany({
      where: { userId: req.user.id, status: 'active' },
      data: { status: 'cancelled', cancelledAt: new Date() } as any,
    });
    return res.json(successResponse('Plan cancelled'));
  } catch (e) { next(e); }
};

export const getUsage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Usage', {})); } catch (e) { next(e); }
};
export const getBenefits = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Benefits', [])); } catch (e) { next(e); }
};
