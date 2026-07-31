import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.investorProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { email: true, fullName: true, avatarUrl: true, bio: true, phone: true, country: true, city: true } } }
    });
    if (!profile) return res.status(404).json(errorResponse('Investor profile not found', 'NOT_FOUND'));
    return res.json(successResponse('Profile retrieved', profile));
  } catch (error) { next(error); }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firm, ticketMin, ticketMax, focusAreas, bio, fullName } = req.body;
    const [profile] = await Promise.all([
      prisma.investorProfile.upsert({
        where: { userId: req.user.id },
        update: { firm, ticketMin: ticketMin ? parseFloat(ticketMin) : undefined, ticketMax: ticketMax ? parseFloat(ticketMax) : undefined, focusAreas },
        create: { userId: req.user.id, firm, ticketMin: ticketMin ? parseFloat(ticketMin) : undefined, ticketMax: ticketMax ? parseFloat(ticketMax) : undefined, focusAreas }
      }),
      fullName || bio ? prisma.user.update({ where: { id: req.user.id }, data: { fullName, bio } }) : Promise.resolve()
    ]);
    return res.json(successResponse('Profile updated', profile));
  } catch (error) { next(error); }
};

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    const url = uploadedFileUrl(req.file);
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    return res.status(201).json(successResponse('Avatar uploaded', { url }));
  } catch (error) { next(error); }
};

export const uploadCover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return respondWithUploadedFile(req, res, 'Cover uploaded'); } catch (error) { next(error); }
};

export const uploadDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return respondWithUploadedFile(req, res, 'Document uploaded'); } catch (error) { next(error); }
};

export const getProfileCompletion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id } }),
      prisma.investorProfile.findUnique({ where: { userId: req.user.id } })
    ]);
    const steps = [
      { step: 'Basic info', done: !!user?.fullName },
      { step: 'Bio', done: !!user?.bio },
      { step: 'Firm', done: !!profile?.firm },
      { step: 'Investment range', done: !!profile?.ticketMin },
      { step: 'Focus areas', done: !!profile?.focusAreas },
      { step: 'Avatar', done: !!user?.avatarUrl }
    ];
    const done = steps.filter(s => s.done).length;
    return res.json(successResponse('Profile completion', { percentage: Math.round((done / steps.length) * 100), steps }));
  } catch (error) { next(error); }
};
