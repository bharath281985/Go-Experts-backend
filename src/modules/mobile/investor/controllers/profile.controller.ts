import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';

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
      include: { investorProfile: true }
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
      bio: user.bio || reg.thesis || reg.bio || "",
      thesis: user.bio || reg.thesis || "",
      city: user.city || reg.city || "",
      state: reg.state || reg.stateCode || "",
      stateCode: reg.stateCode || reg.state || "",
      country: user.country || reg.country || "",
      firm: user.investorProfile?.firm || reg.firm || reg.firmName || "",
      firmName: user.investorProfile?.firm || reg.firm || reg.firmName || "",
      investorType: reg.investorType || reg.type || "Angel Investor",
      ticketMin: user.investorProfile?.ticketMin ?? reg.ticketMin ?? null,
      ticketMax: user.investorProfile?.ticketMax ?? reg.ticketMax ?? null,
      focusAreas: user.investorProfile?.focusAreas || (Array.isArray(reg.categories) ? reg.categories.join(", ") : reg.focusAreas) || "",
      categories: Array.isArray(reg.categories) ? reg.categories : (user.investorProfile?.focusAreas ? user.investorProfile.focusAreas.split(",").map(s => s.trim()) : []),
      industries: Array.isArray(reg.industries) ? reg.industries : (user.investorProfile?.focusAreas ? user.investorProfile.focusAreas.split(",").map(s => s.trim()) : []),
      stages: Array.isArray(reg.stages) ? reg.stages : [],
      modes: Array.isArray(reg.modes) ? reg.modes : Array.isArray(reg.investmentModes) ? reg.investmentModes : [],
      investmentModes: Array.isArray(reg.investmentModes) ? reg.investmentModes : Array.isArray(reg.modes) ? reg.modes : [],
      goals: Array.isArray(reg.goals) ? reg.goals : Array.isArray(reg.investorGoals) ? reg.investorGoals : [],
      investorGoals: Array.isArray(reg.investorGoals) ? reg.investorGoals : Array.isArray(reg.goals) ? reg.goals : [],
      linkedin: reg.linkedin || reg.linkedinUrl || "",
      website: reg.website || reg.websiteUrl || "",
      panNumber: reg.panNumber || reg.panGst || "",
      aadhaarNumber: reg.aadhaarNumber || "",
      panGst: reg.panGst || reg.panNumber || "",
      deals: user.investorProfile?.deals ?? 0,
      status: user.status,
      verified: Boolean(user.isVerified || user.verified),
      role: user.role,
      // user: {
      //   email: user.email,
      //   fullName: user.fullName,
      //   avatarUrl: user.avatarUrl,
      //   bio: user.bio,
      //   phone: user.phone,
      //   country: user.country,
      //   city: user.city,
      // }
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
    const bioVal = b.bio || b.thesis;
    const cityVal = b.city;
    const countryVal = b.country;
    const avatarVal = b.avatarUrl || b.avatar;
    const firmVal = b.firm || b.firmName;
    const ticketMinVal = b.ticketMin ?? b.minTicket;
    const ticketMaxVal = b.ticketMax ?? b.maxTicket;
    const focusAreasVal = b.focusAreas || (Array.isArray(b.categories) ? b.categories.join(", ") : b.categories) || (Array.isArray(b.industries) ? b.industries.join(", ") : b.industries);

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
      thesis: b.thesis || currentReg.thesis,
      city: cityVal != null ? String(cityVal) : currentReg.city,
      state: b.state || b.stateCode || currentReg.state,
      stateCode: b.stateCode || b.state || currentReg.stateCode,
      country: countryVal != null ? String(countryVal) : currentReg.country,
      firm: firmVal != null ? String(firmVal) : currentReg.firm,
      firmName: firmVal != null ? String(firmVal) : currentReg.firmName,
      investorType: b.investorType || b.type || currentReg.investorType,
      ticketMin: ticketMinVal != null && ticketMinVal !== "" ? parseFloat(ticketMinVal) : currentReg.ticketMin,
      ticketMax: ticketMaxVal != null && ticketMaxVal !== "" ? parseFloat(ticketMaxVal) : currentReg.ticketMax,
      focusAreas: focusAreasVal || currentReg.focusAreas,
      categories: Array.isArray(b.categories) ? b.categories : currentReg.categories,
      industries: Array.isArray(b.industries) ? b.industries : currentReg.industries,
      stages: Array.isArray(b.stages) ? b.stages : currentReg.stages,
      modes: Array.isArray(b.modes) ? b.modes : Array.isArray(b.investmentModes) ? b.investmentModes : currentReg.modes,
      investmentModes: Array.isArray(b.investmentModes) ? b.investmentModes : Array.isArray(b.modes) ? b.modes : currentReg.investmentModes,
      goals: Array.isArray(b.goals) ? b.goals : Array.isArray(b.investorGoals) ? b.investorGoals : currentReg.goals,
      investorGoals: Array.isArray(b.investorGoals) ? b.investorGoals : Array.isArray(b.goals) ? b.goals : currentReg.investorGoals,
      linkedin: b.linkedin || b.linkedinUrl || currentReg.linkedin,
      website: b.website || b.websiteUrl || currentReg.website,
      panNumber: b.panNumber || b.panGst || currentReg.panNumber,
      aadhaarNumber: b.aadhaarNumber || currentReg.aadhaarNumber,
      panGst: b.panGst || b.panNumber || currentReg.panGst,
      avatarUrl: userUpdateData.avatarUrl || currentReg.avatarUrl,
    };

    userUpdateData.registrationData = updatedReg;

    await prisma.user.update({
      where: { id: req.user.id },
      data: userUpdateData
    });

    const parsedMin = ticketMinVal != null && ticketMinVal !== "" ? parseFloat(ticketMinVal) : undefined;
    const parsedMax = ticketMaxVal != null && ticketMaxVal !== "" ? parseFloat(ticketMaxVal) : undefined;
    const focusStr = focusAreasVal != null ? (Array.isArray(focusAreasVal) ? focusAreasVal.join(", ") : String(focusAreasVal)) : undefined;

    await prisma.investorProfile.upsert({
      where: { userId: req.user.id },
      update: {
        firm: firmVal != null ? String(firmVal).trim() || null : undefined,
        ticketMin: parsedMin,
        ticketMax: parsedMax,
        focusAreas: focusStr,
      },
      create: {
        userId: req.user.id,
        firm: firmVal != null ? String(firmVal).trim() || null : null,
        ticketMin: parsedMin || null,
        ticketMax: parsedMax || null,
        focusAreas: focusStr || null,
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

