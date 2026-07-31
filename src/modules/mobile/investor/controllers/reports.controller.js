import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getReports = async (req, res, next) => {
    try {
        return res.json(successResponse('Reports overview', []));
    }
    catch (error) {
        next(error);
    }
};
export const getPortfolioReport = async (req, res, next) => {
    try {
        const investments = await prisma.investment.findMany({ where: { investor: req.user.id } });
        return res.json(successResponse('Portfolio report', { totalInvestments: investments.length, investments }));
    }
    catch (error) {
        next(error);
    }
};
export const getRoiReport = async (req, res, next) => {
    try {
        return res.json(successResponse('ROI report', { overallROI: 0, byStartup: [] }));
    }
    catch (error) {
        next(error);
    }
};
export const getIndustryReport = async (req, res, next) => {
    try {
        return res.json(successResponse('Industry report', { industrySplit: [] }));
    }
    catch (error) {
        next(error);
    }
};
export const exportReport = async (req, res, next) => {
    try {
        return res.json(successResponse('Report ready for download', { url: `/mock-exports/report-${req.user.id}.pdf` }));
    }
    catch (error) {
        next(error);
    }
};
