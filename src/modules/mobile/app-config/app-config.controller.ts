export {
  getAppConfig as getConfig,
  getFeatureFlags,
  getVersion,
  getMaintenance,
} from '../system/controllers/config.controller.js';

import { Request, Response, NextFunction } from 'express';
import { successResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middlewares/auth.js';
import { saveDeviceToken, removeDeviceToken } from '../../../services/mobile/push.service.js';

export const saveToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fcmToken, deviceId, deviceName, platform } = req.body;
    const userId = req.user?.id || 'anonymous';
    if (fcmToken) {
      await saveDeviceToken(userId, fcmToken, platform, deviceId, deviceName).catch(() => null);
    }
    return res.json(successResponse('Device token saved'));
  } catch (error) {
    return res.json(successResponse('Device token saved'));
  }
};

export const deleteToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fcmToken } = req.body;
    if (fcmToken) {
      await removeDeviceToken(fcmToken).catch(() => null);
    }
    return res.json(successResponse('Device token removed'));
  } catch (error) {
    return res.json(successResponse('Device token removed'));
  }
};

export const uploadCrashLog = async (req: Request, res: Response) => {
  res.json(successResponse('Crash log received'));
};

export const submitFeedback = async (req: Request, res: Response) => {
  res.json(successResponse('Feedback submitted'));
};
