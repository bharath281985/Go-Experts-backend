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
      include: { investorProfile: true }
    });
    if (!user) return res.status(404).json(errorResponse('User not found', 'NOT_FOUND'));

    const reg = parseRegData(user.registrationData);

    const rawCats = user.investorProfile?.focusAreas || reg.categories || reg.categoryIds || reg.focusAreas;
    const rawStages = reg.stages || reg.stageIds;
    const rawModes = reg.investmentModes || reg.modes || reg.modeIds;
    const rawGoals = reg.investorGoals || reg.goals || reg.goalIds;

    const [resolvedCats, resolvedStages, resolvedModes, resolvedGoals] = await Promise.all([
      resolveMasterOptionsInput(rawCats),
      resolveMasterOptionsInput(rawStages, 'startup_stage'),
      resolveMasterOptionsInput(rawModes, 'investment_mode'),
      resolveMasterOptionsInput(rawGoals, 'investor_goal'),
    ]);

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
      focusAreas: resolvedCats.joinedStr || user.investorProfile?.focusAreas || "",
      categoryIds: resolvedCats.ids,
      categories: resolvedCats.labels,
      industries: resolvedCats.labels,
      stageIds: resolvedStages.ids,
      stages: resolvedStages.labels,
      modeIds: resolvedModes.ids,
      modes: resolvedModes.labels,
      investmentModes: resolvedModes.labels,
      goalIds: resolvedGoals.ids,
      goals: resolvedGoals.labels,
      investorGoals: resolvedGoals.labels,
      linkedin: reg.linkedin || reg.linkedinUrl || "",
      website: reg.website || reg.websiteUrl || "",
      panNumber: reg.panNumber || reg.panGst || "",
      aadhaarNumber: reg.aadhaarNumber || "",
      panGst: reg.panGst || reg.panNumber || "",
      deals: user.investorProfile?.deals ?? 0,
      status: user.status,
      verified: Boolean(user.isVerified || user.verified),
      role: user.role,
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

    const rawCats = b.categoryIds ?? b.categories ?? b.focusAreas ?? b.industries;
    const rawStages = b.stageIds ?? b.stages;
    const rawModes = b.modeIds ?? b.investmentModes ?? b.modes;
    const rawGoals = b.goalIds ?? b.investorGoals ?? b.goals;

    const [resolvedCats, resolvedStages, resolvedModes, resolvedGoals] = await Promise.all([
      resolveMasterOptionsInput(rawCats),
      resolveMasterOptionsInput(rawStages, 'startup_stage'),
      resolveMasterOptionsInput(rawModes, 'investment_mode'),
      resolveMasterOptionsInput(rawGoals, 'investor_goal'),
    ]);

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
      focusAreas: resolvedCats.joinedStr || currentReg.focusAreas,
      categoryIds: resolvedCats.ids.length > 0 ? resolvedCats.ids : currentReg.categoryIds,
      categories: resolvedCats.labels.length > 0 ? resolvedCats.labels : currentReg.categories,
      stageIds: resolvedStages.ids.length > 0 ? resolvedStages.ids : currentReg.stageIds,
      stages: resolvedStages.labels.length > 0 ? resolvedStages.labels : currentReg.stages,
      modeIds: resolvedModes.ids.length > 0 ? resolvedModes.ids : currentReg.modeIds,
      modes: resolvedModes.labels.length > 0 ? resolvedModes.labels : currentReg.modes,
      investmentModes: resolvedModes.labels.length > 0 ? resolvedModes.labels : currentReg.investmentModes,
      goalIds: resolvedGoals.ids.length > 0 ? resolvedGoals.ids : currentReg.goalIds,
      goals: resolvedGoals.labels.length > 0 ? resolvedGoals.labels : currentReg.goals,
      investorGoals: resolvedGoals.labels.length > 0 ? resolvedGoals.labels : currentReg.investorGoals,
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
    const focusStr = resolvedCats.joinedStr || undefined;

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

    return res.json(successResponse('Profile updated successfully'));
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

