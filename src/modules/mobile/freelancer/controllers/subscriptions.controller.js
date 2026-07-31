import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getCurrentPlan = async (req, res, next) => {
    try {
        const sub = await prisma.subscription.findFirst({ where: { userId: req.user.id, status: 'active' }, include: { plan: true } });
        return res.json(successResponse('Current plan retrieved', sub));
    }
    catch (error) {
        next(error);
    }
};
export const getAvailablePlans = async (req, res, next) => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            where: {
                status: 'active',
                role: req.user.role
            }
        });
        return res.json(successResponse('Available plans retrieved', plans));
    }
    catch (error) {
        next(error);
    }
};
export const upgradePlan = async (req, res, next) => {
    try {
        return res.json(successResponse('Upgrade initiated. Please complete payment.'));
    }
    catch (error) {
        next(error);
    }
};
export const renewPlan = async (req, res, next) => {
    try {
        return res.json(successResponse('Renewal initiated. Please complete payment.'));
    }
    catch (error) {
        next(error);
    }
};
export const cancelPlan = async (req, res, next) => {
    try {
        return res.json(successResponse('Plan cancelled'));
    }
    catch (error) {
        next(error);
    }
};
export const getUsage = async (req, res, next) => res.json(successResponse('Usage retrieved', { proposalsLeft: 10 }));
export const getBenefits = async (req, res, next) => res.json(successResponse('Benefits retrieved', []));
