import { Response, NextFunction } from 'express';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Documents retrieved', []));
  } catch (error) { next(error); }
};

export const uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Document uploaded', { url: '/uploads/mock-document.pdf' }));
  } catch (error) { next(error); }
};

export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Document deleted'));
  } catch (error) { next(error); }
};

export const downloadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Download ready', { url: '/mock-downloads/document.pdf' }));
  } catch (error) { next(error); }
};

export const previewDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Preview URL generated', { url: '/mock-previews/document.pdf' }));
  } catch (error) { next(error); }
};
