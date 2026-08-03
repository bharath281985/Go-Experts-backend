import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { investorProfile: true }
    });
    if (!user) return res.status(404).json(errorResponse('User not found', 'NOT_FOUND'));

    const profileData = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || "",
      avatarUrl: user.avatarUrl || "",
      bio: user.bio || "",
      city: user.city || "",
      country: user.country || "",
      firm: user.investorProfile?.firm || "",
      ticketMin: user.investorProfile?.ticketMin ?? null,
      ticketMax: user.investorProfile?.ticketMax ?? null,
      focusAreas: user.investorProfile?.focusAreas || "",
      deals: user.investorProfile?.deals ?? 0,
      status: user.status,
      verified: Boolean(user.isVerified || user.verified),
      role: user.role,
      user: {
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        phone: user.phone,
        country: user.country,
        city: user.city,
      }
    };

    return res.json(successResponse('Profile retrieved', profileData));
  } catch (error) { next(error); }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firm, ticketMin, ticketMax, focusAreas, bio, fullName, phone, city, country, avatarUrl } = req.body;

    const userUpdateData: Record<string, any> = {};
    if (fullName != null) userUpdateData.fullName = String(fullName).trim();
    if (bio != null) userUpdateData.bio = String(bio);
    if (phone != null) userUpdateData.phone = String(phone).trim() || null;
    if (city != null) userUpdateData.city = String(city).trim() || null;
    if (country != null) userUpdateData.country = String(country).trim() || null;
    if (avatarUrl != null) userUpdateData.avatarUrl = String(avatarUrl).trim() || null;

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: userUpdateData
      });
    }

    const focusAreasValue =
      focusAreas != null
        ? Array.isArray(focusAreas)
          ? focusAreas.join(", ")
          : String(focusAreas)
        : undefined;

    await prisma.investorProfile.upsert({
      where: { userId: req.user.id },
      update: {
        firm: firm != null ? String(firm).trim() || null : undefined,
        ticketMin: ticketMin != null && ticketMin !== "" ? parseFloat(ticketMin) : undefined,
        ticketMax: ticketMax != null && ticketMax !== "" ? parseFloat(ticketMax) : undefined,
        focusAreas: focusAreasValue,
      },
      create: {
        userId: req.user.id,
        firm: firm != null ? String(firm).trim() || null : null,
        ticketMin: ticketMin != null && ticketMin !== "" ? parseFloat(ticketMin) : null,
        ticketMax: ticketMax != null && ticketMax !== "" ? parseFloat(ticketMax) : null,
        focusAreas: focusAreasValue || null,
      }
    });

    return getProfile(req, res, next);
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

