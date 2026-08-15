import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { uploadedFileUrl, respondWithUploadedFile } from '../../../../utils/uploaded-file.js';
import { resolveSkillsInput } from '../../../../utils/array-option-resolver.js';

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

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Avatar uploaded', { url: '/uploads/mock-avatar.jpg' })); } catch (error) { next(error); }
};

export const uploadCoverImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Cover image uploaded', { url: '/uploads/mock-cover.jpg' })); } catch (error) { next(error); }
};

export const uploadResume = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Resume uploaded', { url: '/uploads/mock-resume.pdf' })); } catch (error) { next(error); }
};

export const uploadKyc = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }
    return respondWithUploadedFile(req, res, 'KYC document uploaded successfully');
  } catch (error) { next(error); }
};
