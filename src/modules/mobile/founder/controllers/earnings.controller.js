import { successResponse } from '../../../../core/response.js';
export const getMonthlyEarnings = async (req, res, next) => {
    try {
        return res.json(successResponse('Monthly earnings retrieved', { total: 0, currentMonth: 0 }));
    }
    catch (error) {
        next(error);
    }
};
export const getYearlyEarnings = async (req, res, next) => {
    try {
        return res.json(successResponse('Yearly earnings retrieved', { total: 0, currentYear: 0 }));
    }
    catch (error) {
        next(error);
    }
};
export const getCategoryEarnings = async (req, res, next) => {
    try {
        return res.json(successResponse('Category earnings retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const getClientEarnings = async (req, res, next) => {
    try {
        return res.json(successResponse('Client earnings retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const downloadStatement = async (req, res, next) => {
    try {
        return res.json(successResponse('Statement ready for download', { url: '/mock-downloads/statement.pdf' }));
    }
    catch (error) {
        next(error);
    }
};
