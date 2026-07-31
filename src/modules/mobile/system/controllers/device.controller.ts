import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listDevices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' }
    });
    return res.json(successResponse('User devices retrieved', devices));
  } catch (error) { next(error); }
};

export const deleteDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.deviceToken.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    return res.json(successResponse('Device removed'));
  } catch (error) { next(error); }
};

export const logoutDevice = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.deviceToken.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    return res.json(successResponse('Device logged out of notifications'));
  } catch (error) { next(error); }
};
