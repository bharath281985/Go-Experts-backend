import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { uploadedFileUrl } from '../../../../utils/uploaded-file.js';
const KEY = (userId) => `pitch_deck:${userId}`;
export const getPitchDeck = async (req, res, next) => {
    try {
        const setting = await prisma.setting.findUnique({ where: { key: KEY(req.user.id) } });
        if (!setting) {
            return res.json(successResponse('Pitch deck retrieved', { url: null, version: 0 }));
        }
        const data = JSON.parse(setting.value);
        return res.json(successResponse('Pitch deck retrieved', data));
    }
    catch (error) {
        next(error);
    }
};
export const uploadPitchDeck = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
        }
        const url = uploadedFileUrl(req.file);
        const payload = { url, version: 1, updatedAt: new Date().toISOString() };
        await prisma.setting.upsert({
            where: { key: KEY(req.user.id) },
            update: { value: JSON.stringify(payload), category: 'founder' },
            create: { key: KEY(req.user.id), value: JSON.stringify(payload), category: 'founder' },
        });
        return res.status(201).json(successResponse('Pitch deck uploaded', payload));
    }
    catch (error) {
        next(error);
    }
};
export const updatePitchDeck = uploadPitchDeck;
export const deletePitchDeck = async (req, res, next) => {
    try {
        await prisma.setting.deleteMany({ where: { key: KEY(req.user.id) } });
        return res.json(successResponse('Pitch deck deleted'));
    }
    catch (error) {
        next(error);
    }
};
