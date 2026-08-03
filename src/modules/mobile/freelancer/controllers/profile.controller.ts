import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { uploadedFileUrl } from '../../../../utils/uploaded-file.js';

function parseRegData(regData: any): Record<string, any> {
  if (!regData) return {};
  if (typeof regData === 'string') {
    try { return JSON.parse(regData); } catch { return {}; }
  }
  if (typeof regData === 'object') return regData;
  return {};
}

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { freelancerProfile: true }
    });
    if (!user) return res.status(404).json(errorResponse('User not found', 'NOT_FOUND'));

    const reg = parseRegData(user.registrationData);

    const profileData = {
      id: user.id,
      userId: user.id,
      fullName: user.fullName,
      name: user.fullName,
      email: user.email,
      phone: user.phone || reg.phone || reg.mobile || "",
      mobile: user.phone || reg.phone || reg.mobile || "",
      phoneNumber: user.phone || reg.phone || reg.mobile || "",
      phoneCode: reg.phoneCode || reg.countryCode || "+91",
      countryCode: reg.countryCode || "IN",
      avatarUrl: user.avatarUrl || reg.avatarUrl || "",
      avatar: user.avatarUrl || reg.avatarUrl || "",
      bio: user.bio || reg.overview || reg.bio || "",
      overview: user.bio || reg.overview || "",
      title: reg.title || reg.professionalTitle || "Freelancer",
      professionalTitle: reg.professionalTitle || reg.title || "Freelancer",
      city: user.city || reg.city || "",
      state: reg.state || reg.stateCode || "",
      stateCode: reg.stateCode || reg.state || "",
      country: user.country || reg.country || "",
      industry: user.freelancerProfile?.industry || reg.industry || "",
      skills: user.freelancerProfile?.skills || (Array.isArray(reg.skills) ? reg.skills.join(",") : reg.skills) || "",
      skillIds: user.freelancerProfile?.skills ? user.freelancerProfile.skills.split(",").map(s => s.trim()) : (Array.isArray(reg.skills) ? reg.skills : []),
      hourlyRate: user.freelancerProfile?.hourlyRate ?? reg.hourlyRate ?? null,
      experience: user.freelancerProfile?.experience || reg.experience || "",
      languages: Array.isArray(reg.languages) ? reg.languages : [],
      education: reg.education || null,
      certificates: Array.isArray(reg.certificates) ? reg.certificates : [],
      socialLinks: reg.socialLinks || null,
      githubUrl: reg.githubUrl || reg.socialLinks?.github || "",
      portfolioUrl: reg.portfolioUrl || reg.socialLinks?.portfolio || "",
      linkedin: reg.linkedin || reg.linkedinUrl || "",
      website: reg.website || reg.websiteUrl || "",
      panNumber: reg.panNumber || "",
      aadhaarNumber: reg.aadhaarNumber || "",
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
    const b = req.body || {};
    const existingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!existingUser) return res.status(404).json(errorResponse('User not found', 'NOT_FOUND'));

    const currentReg = parseRegData(existingUser.registrationData);

    const fullNameVal = b.fullName || b.name;
    const phoneVal = b.phone || b.mobile || b.phoneNumber;
    const bioVal = b.bio || b.overview;
    const cityVal = b.city;
    const countryVal = b.country;
    const avatarVal = b.avatarUrl || b.avatar;
    const industryVal = b.industry;

    const rawSkillIds = b.skillIds ?? b.skills;
    const skillsValue = Array.isArray(rawSkillIds)
      ? rawSkillIds.join(',')
      : (rawSkillIds != null ? String(rawSkillIds) : undefined);

    const userUpdateData: Record<string, any> = {};
    if (fullNameVal != null) userUpdateData.fullName = String(fullNameVal).trim();
    if (bioVal != null) userUpdateData.bio = String(bioVal);
    if (phoneVal != null) userUpdateData.phone = String(phoneVal).trim() || null;
    if (cityVal != null) userUpdateData.city = String(cityVal).trim() || null;
    if (countryVal != null) userUpdateData.country = String(countryVal).trim() || null;

    if (req.file) {
      userUpdateData.avatarUrl = uploadedFileUrl(req.file);
    } else if (avatarVal != null) {
      userUpdateData.avatarUrl = String(avatarVal).trim() || null;
    }

    const updatedReg = {
      ...currentReg,
      fullName: fullNameVal != null ? String(fullNameVal).trim() : currentReg.fullName,
      phone: phoneVal != null ? String(phoneVal).trim() : currentReg.phone,
      mobile: phoneVal != null ? String(phoneVal).trim() : currentReg.mobile,
      phoneNumber: phoneVal != null ? String(phoneVal).trim() : currentReg.phoneNumber,
      phoneCode: b.phoneCode || b.countryCode || currentReg.phoneCode,
      countryCode: b.countryCode || currentReg.countryCode,
      bio: bioVal != null ? String(bioVal) : currentReg.bio,
      overview: b.overview || currentReg.overview,
      title: b.title || b.professionalTitle || currentReg.title,
      professionalTitle: b.professionalTitle || b.title || currentReg.professionalTitle,
      city: cityVal != null ? String(cityVal) : currentReg.city,
      state: b.state || b.stateCode || currentReg.state,
      stateCode: b.stateCode || b.state || currentReg.stateCode,
      country: countryVal != null ? String(countryVal) : currentReg.country,
      industry: industryVal != null ? String(industryVal) : currentReg.industry,
      skills: skillsValue || currentReg.skills,
      hourlyRate: b.hourlyRate != null && b.hourlyRate !== "" ? parseFloat(b.hourlyRate) : currentReg.hourlyRate,
      experience: b.experience || currentReg.experience,
      languages: Array.isArray(b.languages) ? b.languages : currentReg.languages,
      education: b.education || currentReg.education,
      certificates: Array.isArray(b.certificates) ? b.certificates : currentReg.certificates,
      socialLinks: b.socialLinks || currentReg.socialLinks,
      githubUrl: b.githubUrl || currentReg.githubUrl,
      portfolioUrl: b.portfolioUrl || currentReg.portfolioUrl,
      linkedin: b.linkedin || b.linkedinUrl || currentReg.linkedin,
      website: b.website || b.websiteUrl || currentReg.website,
      panNumber: b.panNumber || currentReg.panNumber,
      aadhaarNumber: b.aadhaarNumber || currentReg.aadhaarNumber,
      avatarUrl: userUpdateData.avatarUrl || currentReg.avatarUrl,
    };

    userUpdateData.registrationData = updatedReg;

    await prisma.user.update({
      where: { id: req.user.id },
      data: userUpdateData
    });

    await prisma.freelancerProfile.upsert({
      where: { userId: req.user.id },
      update: {
        skills: skillsValue,
        industry: industryVal != null ? String(industryVal).trim() || null : undefined,
        experience: b.experience != null ? String(b.experience) : undefined,
        hourlyRate: b.hourlyRate != null && b.hourlyRate !== "" ? parseFloat(b.hourlyRate) : undefined
      },
      create: {
        userId: req.user.id,
        skills: skillsValue || "",
        industry: industryVal != null ? String(industryVal).trim() || null : null,
        experience: b.experience != null ? String(b.experience) : null,
        hourlyRate: b.hourlyRate != null && b.hourlyRate !== "" ? parseFloat(b.hourlyRate) : null
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
