import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';

import { getMe, updateMe as authUpdateMe } from '../../auth/auth.controller.js';

export const getProfile = getMe;
export const updateProfile = authUpdateMe;

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }

    const url = uploadedFileUrl(req.file, req);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: url },
    });

    return res.status(201).json(successResponse('Avatar uploaded', { url }));
  } catch (error) {
    next(error);
  }
};

export const uploadCoverImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return respondWithUploadedFile(req, res, 'Cover image uploaded');
  } catch (error) {
    next(error);
  }
};

export const uploadResume = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }

    const url = uploadedFileUrl(req.file, req);
    await prisma.freelancerProfile.upsert({
      where: { userId: req.user.id },
      update: { resumeUrl: url },
      create: { userId: req.user.id, resumeUrl: url },
    });

    return res.status(201).json(successResponse('Resume uploaded', {
      url,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename,
    }));
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
  } catch (error) {
    next(error);
  }
};
