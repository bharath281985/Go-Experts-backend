import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getCurrentPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findFirst({ where: { userId: req.user.id, status: 'active' }, include: { plan: true } });
    return res.json(successResponse('Current plan retrieved', sub));
  } catch (error) { next(error); }
};

export const getAvailablePlans = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: {
        status: 'active',
        role: req.user.role
      }
    });
    return res.json(successResponse('Available plans retrieved', plans));
  } catch (error) { next(error); }
};

export const upgradePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Upgrade initiated. Please complete payment.'));
  } catch (error) { next(error); }
};

export const renewPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Renewal initiated. Please complete payment.'));
  } catch (error) { next(error); }
};

export const cancelPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Plan cancelled'));
  } catch (error) { next(error); }
};

export const getUsage = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Usage retrieved', { proposalsLeft: 10 }));
export const getBenefits = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Benefits retrieved', []));
