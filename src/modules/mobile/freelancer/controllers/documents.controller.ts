import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile } from '../../../../utils/uploaded-file.js';
import { buildPublicFileUrl } from '../../../../utils/public-url.js';

const shapeDocument = (file: any, req: AuthRequest) => ({
  id: file.id,
  name: file.originalName,
  filename: file.filename,
  mimeType: file.mimeType,
  filetype: file.filetype,
  size: file.filesize,
  status: file.status,
  url: buildPublicFileUrl(file.filepath, req),
  createdAt: file.createdAt,
  updatedAt: file.updatedAt,
});

export const listDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = await prisma.mediaFile.findMany({
      where: { uploadedBy: req.user.id, deletedAt: null, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json(successResponse('Documents retrieved', files.map((file) => shapeDocument(file, req))));
  } catch (error) {
    next(error);
  }
};

export const uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return respondWithUploadedFile(req, res, 'Document uploaded');
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.mediaFile.updateMany({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null },
      data: { status: 'deleted', deletedAt: new Date() },
    });

    if (!result.count) {
      return res.status(404).json(errorResponse('Document not found', 'NOT_FOUND'));
    }

    return res.json(successResponse('Document deleted'));
  } catch (error) {
    next(error);
  }
};

export const downloadDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null },
    });

    if (!file) {
      return res.status(404).json(errorResponse('Document not found', 'NOT_FOUND'));
    }

    return res.json(successResponse('Download ready', shapeDocument(file, req)));
  } catch (error) {
    next(error);
  }
};

export const previewDocument = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null },
    });

    if (!file) {
      return res.status(404).json(errorResponse('Document not found', 'NOT_FOUND'));
    }

    return res.json(successResponse('Preview URL generated', shapeDocument(file, req)));
  } catch (error) {
    next(error);
  }
};
