import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.freelancerProfile.findUnique({ where: { userId: req.user.id }, include: { user: { select: { email: true, fullName: true, avatarUrl: true } } } });
    if (!profile) return res.status(404).json(errorResponse('Profile not found', 'NOT_FOUND'));
    return res.json(successResponse('Profile retrieved', profile));
  } catch (error) { next(error); }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bio, skills, skillIds, languages, education, experience, availability, hourlyRate, portfolio, certificates, socialLinks } = req.body;
    const rawSkillIds = skillIds ?? skills;
    const skillsValue = Array.isArray(rawSkillIds)
      ? rawSkillIds.join(',')
      : rawSkillIds;
    const profile = await prisma.freelancerProfile.upsert({
      where: { userId: req.user.id },
      update: { skills: skillsValue, experience, hourlyRate },
      create: { userId: req.user.id, skills: skillsValue, experience, hourlyRate }
    });
    return res.json(successResponse('Profile updated', profile));
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
