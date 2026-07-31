import { successResponse } from '../../../../core/response.js';
export const listDocuments = async (req, res, next) => {
    try {
        return res.json(successResponse('Documents retrieved', []));
    }
    catch (error) {
        next(error);
    }
};
export const uploadDocument = async (req, res, next) => {
    try {
        return res.json(successResponse('Document uploaded', { url: '/uploads/mock-document.pdf' }));
    }
    catch (error) {
        next(error);
    }
};
export const deleteDocument = async (req, res, next) => {
    try {
        return res.json(successResponse('Document deleted'));
    }
    catch (error) {
        next(error);
    }
};
export const downloadDocument = async (req, res, next) => {
    try {
        return res.json(successResponse('Download ready', { url: '/mock-downloads/document.pdf' }));
    }
    catch (error) {
        next(error);
    }
};
export const previewDocument = async (req, res, next) => {
    try {
        return res.json(successResponse('Preview URL generated', { url: '/mock-previews/document.pdf' }));
    }
    catch (error) {
        next(error);
    }
};
