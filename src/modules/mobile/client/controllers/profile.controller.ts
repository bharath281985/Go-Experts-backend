import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { clientProfile: true },
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
      company: user.clientProfile?.company || "",
      industry: user.clientProfile?.industry || "",
      totalSpend: Number(user.clientProfile?.totalSpend ?? 0),
      projectsPosted: user.clientProfile?.projectsPosted ?? 0,
      status: user.status,
      verified: Boolean(user.isVerified || user.verified),
      role: user.role,
      user: {
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        country: user.country,
        city: user.city,
      },
    };

    return res.json(successResponse('Profile retrieved', profileData));
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { company, industry, fullName, bio, phone, city, country, avatarUrl, avatar, logo } = req.body;

    const userUpdateData: Record<string, any> = {};
    if (fullName != null) userUpdateData.fullName = String(fullName).trim();
    if (bio != null) userUpdateData.bio = String(bio);
    if (phone != null) userUpdateData.phone = String(phone).trim() || null;
    if (city != null) userUpdateData.city = String(city).trim() || null;
    if (country != null) userUpdateData.country = String(country).trim() || null;

    if (req.file) {
      userUpdateData.avatarUrl = uploadedFileUrl(req.file);
    } else if (avatarUrl != null || avatar != null || logo != null) {
      const urlVal = avatarUrl || avatar || logo;
      userUpdateData.avatarUrl = String(urlVal).trim() || null;
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: userUpdateData,
      });
    }

    await prisma.clientProfile.upsert({
      where: { userId: req.user.id },
      update: {
        company: company != null ? String(company).trim() || null : undefined,
        industry: industry != null ? String(industry).trim() || null : undefined,
      },
      create: {
        userId: req.user.id,
        company: company != null ? String(company).trim() || null : null,
        industry: industry != null ? String(industry).trim() || null : null,
      },
    });

    return getProfile(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const uploadLogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    }
    const url = uploadedFileUrl(req.file);
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    return res.status(201).json(successResponse('Logo uploaded', { url }));
  } catch (error) {
    next(error);
  }
};

export const uploadCover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return respondWithUploadedFile(req, res, 'Cover uploaded');
  } catch (error) {
    next(error);
  }
};

export const uploadDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return respondWithUploadedFile(req, res, 'Document uploaded');
  } catch (error) {
    next(error);
  }
};

export const getProfileCompletion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.clientProfile.findUnique({ where: { userId: req.user.id } });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const steps = [
      { step: 'Basic info', done: !!profile },
      { step: 'Company name', done: !!profile?.company },
      { step: 'Industry', done: !!profile?.industry },
      { step: 'Logo', done: !!user?.avatarUrl },
      { step: 'Address', done: !!(user?.city || user?.country) },
    ];
    const completed = steps.filter((s) => s.done).length;
    return res.json(
      successResponse('Profile completion', {
        percent: Math.round((completed / steps.length) * 100),
        steps,
      })
    );
  } catch (error) {
    next(error);
  }
};
