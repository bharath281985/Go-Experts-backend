import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
import { resolveMasterOptionsInput } from '../../../../utils/array-option-resolver.js';

function parseRegData(regData: any): Record<string, any> {
  if (!regData) return {};
  if (typeof regData === 'string') {
    try { return JSON.parse(regData); } catch { return {}; }
  }
  if (typeof regData === 'object') return regData;
  return {};
}

import { getMe, updateMe as authUpdateMe } from '../../auth/auth.controller.js';

export const getProfile = getMe;
export const updateProfile = authUpdateMe;

export const uploadLogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }
    const url = uploadedFileUrl(req.file);
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    return res.status(201).json(successResponse('Logo uploaded', { url }));
  } catch (error) {
    next(error);
  }
};

export const uploadCover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return respondWithUploadedFile(req, res, 'Cover uploaded');
  } catch (error) {
    next(error);
  }
};

export const uploadDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return respondWithUploadedFile(req, res, 'Document uploaded');
  } catch (error) {
    next(error);
  }
};

export const getProfileCompletion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user.id } });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const steps = [
      { step: 'Basic info', done: !!profile },
      { step: 'Company name', done: !!profile?.company },
      { step: 'Industry', done: !!profile?.industry },
      { step: 'Logo', done: !!user?.avatarUrl },
      { step: 'Address', done: !!(user?.city || user?.country) },
    ];
    const completed = steps.filter((s) => s.done).length;
    return res.json(
      successResponse('Profile completion', {
        percent: Math.round((completed / steps.length) * 100),
        steps,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const uploadKyc = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }
    return respondWithUploadedFile(req, res, 'KYC document uploaded successfully');
  } catch (error) { next(error); }
};
