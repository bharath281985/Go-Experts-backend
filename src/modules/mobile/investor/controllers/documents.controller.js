import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { respondWithUploadedFile } from '../../../../utils/uploaded-file.js';
export const listDocuments = async (req, res, next) => {
    try {
        const files = await prisma.mediaFile.findMany({
            where: { uploadedBy: req.user.id, deletedAt: null, status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return res.json(successResponse('Documents retrieved', files));
    }
    catch (error) {
        next(error);
    }
};
export const uploadDocument = async (req, res, next) => {
    try {
        return respondWithUploadedFile(req, res, 'Document uploaded');
    }
    catch (error) {
        next(error);
    }
};
export const getDocument = async (req, res, next) => {
    try {
        const file = await prisma.mediaFile.findFirst({
            where: { id: req.params.id, uploadedBy: req.user.id },
        });
        if (!file)
            return res.status(404).json(errorResponse('Document not found', 'NOT_FOUND'));
        const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
        return res.json(successResponse('Document details', {
            id: file.id,
            url: `${BASE_URL}/${file.filepath.replace(/\\/g, '/')}`,
            name: file.originalName,
        }));
    }
    catch (error) {
        next(error);
    }
};
export const deleteDocument = async (req, res, next) => {
    try {
        await prisma.mediaFile.updateMany({
            where: { id: req.params.id, uploadedBy: req.user.id },
            data: { status: 'deleted', deletedAt: new Date() },
        });
        return res.json(successResponse('Document deleted'));
    }
    catch (error) {
        next(error);
    }
};
