import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { freelancerProfile: true }
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
      industry: user.freelancerProfile?.industry || "",
      skills: user.freelancerProfile?.skills || "",
      hourlyRate: user.freelancerProfile?.hourlyRate ?? null,
      experience: user.freelancerProfile?.experience || "",
      rating: user.freelancerProfile?.rating ?? 0,
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
    const { bio, skills, skillIds, industry, experience, hourlyRate, fullName, phone, city, country, avatarUrl } = req.body;
    const rawSkillIds = skillIds ?? skills;
    const skillsValue = Array.isArray(rawSkillIds)
      ? rawSkillIds.join(',')
      : (rawSkillIds != null ? String(rawSkillIds) : undefined);

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

    await prisma.freelancerProfile.upsert({
      where: { userId: req.user.id },
      update: {
        skills: skillsValue,
        industry: industry != null ? String(industry).trim() || null : undefined,
        experience: experience != null ? String(experience) : undefined,
        hourlyRate: hourlyRate != null && hourlyRate !== "" ? parseFloat(hourlyRate) : undefined
      },
      create: {
        userId: req.user.id,
        skills: skillsValue || "",
        industry: industry != null ? String(industry).trim() || null : null,
        experience: experience != null ? String(experience) : null,
        hourlyRate: hourlyRate != null && hourlyRate !== "" ? parseFloat(hourlyRate) : null
      }
    });

    return getProfile(req, res, next);
  } catch (error) { next(error); }
};

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Avatar uploaded', { url: '/uploads/mock-avatar.jpg' })); } catch (error) { next(error); }
};

export const uploadCoverImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Cover image uploaded', { url: '/uploads/mock-cover.jpg' })); } catch (error) { next(error); }
};

export const uploadResume = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Resume uploaded', { url: '/uploads/mock-resume.pdf' })); } catch (error) { next(error); }
};

export const uploadKyc = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('KYC uploaded', { url: '/uploads/mock-kyc.pdf' })); } catch (error) { next(error); }
};
