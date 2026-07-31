import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getMonthlyEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Monthly earnings retrieved', { total: 0, currentMonth: 0 }));
  } catch (error) { next(error); }
};

export const getYearlyEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Yearly earnings retrieved', { total: 0, currentYear: 0 }));
  } catch (error) { next(error); }
};

export const getCategoryEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Category earnings retrieved', []));
  } catch (error) { next(error); }
};

export const getClientEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Client earnings retrieved', []));
  } catch (error) { next(error); }
};

export const downloadStatement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Statement ready for download', { url: '/mock-downloads/statement.pdf' }));
  } catch (error) { next(error); }
};
