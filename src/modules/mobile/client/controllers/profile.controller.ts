import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
import { resolveMasterOptionsInput } from '../../../../utils/array-option-resolver.js';

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
      include: { clientProfile: true },
    });
    if (!user) return res.status(404).json(errorResponse('User not found', 'NOT_FOUND'));

    const reg = parseRegData(user.registrationData);
    const rawGoals = reg.clientGoals || reg.goals || reg.goalIds;
    const resolvedGoals = await resolveMasterOptionsInput(rawGoals, 'client_goal');

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
      avatarUrl: user.avatarUrl || reg.avatarUrl || reg.logo || "",
      avatar: user.avatarUrl || reg.avatarUrl || reg.logo || "",
      logo: user.avatarUrl || reg.avatarUrl || reg.logo || "",
      bio: user.bio || reg.bio || "",
      city: user.city || reg.city || "",
      state: reg.state || reg.stateCode || "",
      stateCode: reg.stateCode || reg.state || "",
      country: user.country || reg.country || "",
      company: user.clientProfile?.company || reg.company || reg.companyName || "",
      companyName: user.clientProfile?.company || reg.company || reg.companyName || "",
      industry: user.clientProfile?.industry || reg.industry || "",
      companySize: reg.companySize || reg.teamSize || "11-50",
      teamSize: reg.teamSize || reg.companySize || 10,
      goalIds: resolvedGoals.ids,
      clientGoals: resolvedGoals.labels,
      goals: resolvedGoals.labels,
      linkedin: reg.linkedin || reg.linkedinUrl || "",
      website: reg.website || reg.websiteUrl || "",
      panNumber: reg.panNumber || "",
      aadhaarNumber: reg.aadhaarNumber || "",
      totalSpend: Number(user.clientProfile?.totalSpend ?? 0),
      projectsPosted: user.clientProfile?.projectsPosted ?? 0,
      status: user.status || "active",
      verified: Boolean(user.isVerified || user.verified),
      role: user.role,
    };

    return res.json(successResponse('Profile retrieved', profileData));
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    const existingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!existingUser) return res.status(404).json(errorResponse('User not found', 'NOT_FOUND'));

    const currentReg = parseRegData(existingUser.registrationData);

    const fullNameVal = b.fullName || b.name;
    const phoneVal = b.phone || b.mobile || b.phoneNumber;
    const bioVal = b.bio;
    const cityVal = b.city;
    const countryVal = b.country;
    const avatarVal = b.avatarUrl || b.avatar || b.logo;
    const companyVal = b.company || b.companyName;
    const industryVal = b.industry;

    const rawGoals = b.goalIds ?? b.clientGoals ?? b.goals;
    const resolvedGoals = await resolveMasterOptionsInput(rawGoals, 'client_goal');

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
      city: cityVal != null ? String(cityVal) : currentReg.city,
      state: b.state || b.stateCode || currentReg.state,
      stateCode: b.stateCode || b.state || currentReg.stateCode,
      country: countryVal != null ? String(countryVal) : currentReg.country,
      company: companyVal != null ? String(companyVal) : currentReg.company,
      companyName: companyVal != null ? String(companyVal) : currentReg.companyName,
      industry: industryVal != null ? String(industryVal) : currentReg.industry,
      companySize: b.companySize || b.teamSize || currentReg.companySize,
      teamSize: b.teamSize || b.companySize || currentReg.teamSize,
      goalIds: resolvedGoals.ids.length > 0 ? resolvedGoals.ids : currentReg.goalIds,
      clientGoals: resolvedGoals.labels.length > 0 ? resolvedGoals.labels : currentReg.clientGoals,
      goals: resolvedGoals.labels.length > 0 ? resolvedGoals.labels : currentReg.goals,
      linkedin: b.linkedin || b.linkedinUrl || currentReg.linkedin,
      website: b.website || b.websiteUrl || currentReg.website,
      panNumber: b.panNumber || currentReg.panNumber,
      aadhaarNumber: b.aadhaarNumber || currentReg.aadhaarNumber,
      avatarUrl: userUpdateData.avatarUrl || currentReg.avatarUrl,
      logo: userUpdateData.avatarUrl || currentReg.logo,
    };

    userUpdateData.registrationData = updatedReg;

    await prisma.user.update({
      where: { id: req.user.id },
      data: userUpdateData,
    });

    await prisma.clientProfile.upsert({
      where: { userId: req.user.id },
      update: {
        company: companyVal != null ? String(companyVal).trim() || null : undefined,
        industry: industryVal != null ? String(industryVal).trim() || null : undefined,
      },
      create: {
        userId: req.user.id,
        company: companyVal != null ? String(companyVal).trim() || null : null,
        industry: industryVal != null ? String(industryVal).trim() || null : null,
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
