import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getMimeCategory } from '../../../../middleware/upload.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

const mapFile = (record: any) => ({
  id: record.id,
  userId: record.uploadedBy,
  originalName: record.originalName,
  filename: record.filename,
  mimeType: record.mimeType,
  size: record.filesize,
  category: record.filetype,
  path: record.filepath,
  url: `${BASE_URL}/${record.filepath.replace(/\\/g, '/')}`,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

export const uploadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }

    const { category } = req.body;
    const file = req.file;
    const detectedCategory = category || getMimeCategory(file.mimetype);

    if (
      String(category || '') === 'project_attachment' &&
      getMimeCategory(file.mimetype) === 'image'
    ) {
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      return res.status(400).json(
        errorResponse('Images are not allowed for project attachments', 'VALIDATION_ERROR')
      );
    }

    const relativePath = file.path.replace(/\\/g, '/');

    const record = await prisma.mediaFile.create({
      data: {
        uploadedBy: req.user.id,
        originalName: file.originalname,
        filename: file.filename,
        mimeType: file.mimetype,
        filesize: file.size,
        filetype: detectedCategory,
        filepath: relativePath,
        status: 'active'
      }
    });

    return res.status(201).json(successResponse('File uploaded successfully', mapFile(record)));
  } catch (error) { next(error); }
};

export const uploadMultiple = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json(errorResponse('No files provided', 'VALIDATION_ERROR'));
    }

    const { category } = req.body;
    const records = [];

    for (const file of files) {
      const detectedCategory = category || getMimeCategory(file.mimetype);
      const record = await prisma.mediaFile.create({
        data: {
          uploadedBy: req.user.id,
          originalName: file.originalname,
          filename: file.filename,
          mimeType: file.mimetype,
          filesize: file.size,
          filetype: detectedCategory,
          filepath: file.path.replace(/\\/g, '/'),
          status: 'active'
        }
      });
      records.push(mapFile(record));
    }

    return res.status(201).json(successResponse(`${records.length} file(s) uploaded successfully`, records));
  } catch (error) { next(error); }
};

export const listFiles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const category = req.query.category as string | undefined;

    const where: any = { uploadedBy: req.user.id, deletedAt: null, status: 'active' };
    if (category) where.filetype = category;

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.mediaFile.count({ where })
    ]);

    return res.json(successResponse('Files retrieved', files.map(mapFile), { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null, status: 'active' }
    });
    if (!file) return res.status(404).json(errorResponse('File not found', 'NOT_FOUND'));
    return res.json(successResponse('File retrieved', mapFile(file)));
  } catch (error) { next(error); }
};

export const previewFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null, status: 'active' }
    });
    if (!file) return res.status(404).json(errorResponse('File not found', 'NOT_FOUND'));

    const mapped = mapFile(file);
    const isViewable = ['image', 'document'].includes(file.filetype) || file.mimeType === 'application/pdf';

    return res.json(successResponse('Preview URL', {
      id: mapped.id,
      name: mapped.originalName,
      mimeType: mapped.mimeType,
      previewUrl: mapped.url,
      thumbnailUrl: null,
      isInlineViewable: isViewable
    }));
  } catch (error) { next(error); }
};

export const downloadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null, status: 'active' }
    });
    if (!file) return res.status(404).json(errorResponse('File not found', 'NOT_FOUND'));

    const basePath = path.resolve('uploads');
    const absolutePath = path.resolve(basePath, file.filepath);

    if (!absolutePath.startsWith(basePath)) {
      return res.status(403).json(errorResponse('Access denied', 'FORBIDDEN'));
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(410).json(errorResponse('File no longer exists on disk', 'FILE_GONE'));
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.setHeader('Content-Type', file.mimeType);
    return res.sendFile(absolutePath);
  } catch (error) { next(error); }
};

export const renameFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json(errorResponse('New name is required', 'VALIDATION_ERROR'));

    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null, status: 'active' }
    });
    if (!file) return res.status(404).json(errorResponse('File not found', 'NOT_FOUND'));

    const updated = await prisma.mediaFile.update({ where: { id: file.id }, data: { originalName: name } });
    return res.json(successResponse('File renamed', mapFile(updated)));
  } catch (error) { next(error); }
};

export const deleteFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, deletedAt: null, status: 'active' }
    });
    if (!file) return res.status(404).json(errorResponse('File not found', 'NOT_FOUND'));

    await prisma.mediaFile.update({
      where: { id: file.id },
      data: { status: 'deleted', deletedAt: new Date() }
    });
    return res.json(successResponse('File moved to trash'));
  } catch (error) { next(error); }
};

export const restoreFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, uploadedBy: req.user.id, status: 'deleted' }
    });
    if (!file) return res.status(404).json(errorResponse('File not found in trash', 'NOT_FOUND'));

    await prisma.mediaFile.update({
      where: { id: file.id },
      data: { status: 'active', deletedAt: null }
    });
    return res.json(successResponse('File restored successfully'));
  } catch (error) { next(error); }
};

export const listTrash = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = await prisma.mediaFile.findMany({
      where: { uploadedBy: req.user.id, status: 'deleted' },
      orderBy: { deletedAt: 'desc' }
    });
    return res.json(successResponse('Trash retrieved', files.map(mapFile)));
  } catch (error) { next(error); }
};

export const getStorageUsage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = await prisma.mediaFile.findMany({
      where: { uploadedBy: req.user.id, deletedAt: null, status: 'active' },
      select: { filesize: true, filetype: true }
    });

    const totalBytes = files.reduce((sum, f) => sum + f.filesize, 0);
    const maxBytes = parseInt(process.env.USER_STORAGE_LIMIT || '1073741824');

    const byCategory: Record<string, number> = {};
    for (const f of files) {
      byCategory[f.filetype] = (byCategory[f.filetype] || 0) + f.filesize;
    }

    return res.json(successResponse('Storage usage retrieved', {
      totalFiles: files.length,
      usedBytes: totalBytes,
      usedMB: (totalBytes / 1024 / 1024).toFixed(2),
      limitBytes: maxBytes,
      limitMB: (maxBytes / 1024 / 1024).toFixed(2),
      percentUsed: ((totalBytes / maxBytes) * 100).toFixed(2),
      byCategory
    }));
  } catch (error) { next(error); }
};
