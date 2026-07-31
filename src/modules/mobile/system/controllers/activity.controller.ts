import { Response, NextFunction } from 'express';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getUserActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    return res.json(successResponse('Activity Feed', [], { page, limit, total: 0, totalPages: 0 }));
  } catch (error) { next(error); }
};

export const getUserAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    return res.json(successResponse('Audit Logs', [], { page, limit, total: 0, totalPages: 0 }));
  } catch (error) { next(error); }
};
