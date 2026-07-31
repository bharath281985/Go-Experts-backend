import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const prefs = await prisma.notificationPreference.findUnique({ where: { userId: req.user.id } });
    return res.json(successResponse('Settings retrieved', {
      language: 'en',
      privacy: 'public',
      visibility: true,
      notificationPreferences: prefs || { emailEnabled: true, pushEnabled: true, inAppEnabled: true }
    }));
  } catch (error) { next(error); }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Settings updated', req.body)); } catch (error) { next(error); }
};
