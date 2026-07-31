import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getPortfolio = async (req, res, next) => {
    try {
        const investments = await prisma.investment.findMany({
            where: { investor: req.user.id, status: { in: ['Active', 'Closed', 'Completed'] } },
            orderBy: { createdAt: 'desc' }
        });
        const totalInvested = investments.reduce((sum, inv) => sum + inv.offer, 0);
        const activeInvestments = investments.filter(i => i.status === 'Active');
        return res.json(successResponse('Portfolio retrieved', { investments, totalInvested, activeCount: activeInvestments.length }));
    }
    catch (error) {
        next(error);
    }
};
export const getPortfolioItem = async (req, res, next) => {
    try {
        const investment = await prisma.investment.findFirst({ where: { id: req.params.id, investor: req.user.id } });
        return res.json(successResponse('Portfolio item retrieved', investment));
    }
    catch (error) {
        next(error);
    }
};
export const getPortfolioPerformance = async (req, res, next) => {
    try {
        const investments = await prisma.investment.findMany({ where: { investor: req.user.id } });
        const totalInvested = investments.reduce((sum, inv) => sum + inv.offer, 0);
        return res.json(successResponse('Portfolio performance', {
            totalInvested,
            currentValue: totalInvested,
            roi: 0,
            gain: 0,
            loss: 0,
            performanceByMonth: [0, 0, 0, 0, 0, 0]
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getPortfolioAllocation = async (req, res, next) => {
    try {
        const investments = await prisma.investment.findMany({ where: { investor: req.user.id } });
        return res.json(successResponse('Portfolio allocation', { byIndustry: [], byStage: [], investments }));
    }
    catch (error) {
        next(error);
    }
};
export const getPortfolioROI = async (req, res, next) => {
    try {
        return res.json(successResponse('Portfolio ROI', { overallROI: 0, byStartup: [], roiTrend: [0, 0, 0, 0, 0, 0] }));
    }
    catch (error) {
        next(error);
    }
};
