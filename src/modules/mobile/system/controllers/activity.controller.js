import { successResponse } from '../../../../core/response.js';
export const getUserActivity = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        return res.json(successResponse('Activity Feed', [], { page, limit, total: 0, totalPages: 0 }));
    }
    catch (error) {
        next(error);
    }
};
export const getUserAuditLogs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        return res.json(successResponse('Audit Logs', [], { page, limit, total: 0, totalPages: 0 }));
    }
    catch (error) {
        next(error);
    }
};
