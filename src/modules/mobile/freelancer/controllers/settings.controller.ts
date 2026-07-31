import { Response, NextFunction } from 'express';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Settings retrieved', {
      emailNotifications: true,
      pushNotifications: true,
      darkMode: false,
      language: 'en',
      privacy: { profileVisible: true, showEarnings: false },
      security: { twoFactorEnabled: false }
    }));
  } catch (error) { next(error); }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Settings updated', req.body));
  } catch (error) { next(error); }
};
