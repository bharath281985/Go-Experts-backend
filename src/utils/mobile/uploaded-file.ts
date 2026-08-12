import { Response } from 'express';
import { errorResponse, successResponse } from '../../core/response.js';
import { AuthRequest } from '../../middlewares/auth.middleware.js';
import path from 'path';
import { UPLOADS_DIR } from '../../config/uploads.js';

const getBaseUrl = (req?: any) => {
  const envUrl = process.env.BASE_URL || process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl && !envUrl.includes('localhost')) return envUrl.replace(/\/+$/, '');
  if (req?.get) {
    const host = req.get('host');
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    if (host && !host.includes('localhost')) return `${proto}://${host}`;
  }
  return envUrl ? envUrl.replace(/\/+$/, '') : 'https://apiai.goexperts.in';
};

/** Build public URL for a multer-uploaded file. */
export const uploadedFileUrl = (file: Express.Multer.File, req?: any) => {
  const relativePath = path.relative(UPLOADS_DIR, file.path).replace(/\\/g, '/');
  return `${getBaseUrl(req)}/uploads/${relativePath}`;
};

/** Standard attachment/profile upload response from req.file. */
export const respondWithUploadedFile = (
  req: AuthRequest,
  res: Response,
  message = 'File uploaded'
) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
  }
  const url = uploadedFileUrl(file);
  return res.status(201).json(
    successResponse(message, {
      url,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      filename: file.filename,
    })
  );
};
