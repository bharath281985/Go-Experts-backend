import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';
import { resolveMasterOptionsInput } from '../../../../utils/array-option-resolver.js';
import { getJsonSetting } from '../../../../common/helpers/portal-shared.js';

async function resolveId(val: any, model: string) {
  if (!val) return "";
  try {
    const delegate = (prisma as any)[model];
    if (delegate) {
      const found = await delegate.findFirst({
        where: { OR: [{ id: val }, { name: val }] },
        select: { id: true }
      });
      return found?.id || val;
    }
  } catch { }
  return val;
}

function parseRegData(regData: any): Record<string, any> {
  if (!regData) return {};
  if (typeof regData === 'string') {
    try { return JSON.parse(regData); } catch { return {}; }
  }
  if (typeof regData === 'object') return regData;
  return {};
}

import { getMe, updateMe as authUpdateMe } from '../../auth/auth.controller.js';

export const getProfile = getMe;

export const getStartup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, fullName: true, email: true, avatarUrl: true, bio: true, phone: true, country: true, city: true, role: true, registrationData: true }
    });

    const [profile, idea] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } }).catch(() => null),
      prisma.startupIdea.findFirst({
        where: {
          OR: [
            { founder: req.user.id },
            { founder: user?.fullName || '__none__' }
          ],
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' }
      }).catch(() => null)
    ]);

    let startup = idea;
    if (!startup) {
      startup = await prisma.startupIdea.create({
        data: {
          founder: req.user.id,
          startup: profile?.startupName || (user?.fullName ? `${user.fullName}'s Startup` : 'My Startup'),
          industry: profile?.industry || 'Technology',
          category: 'General',
          stage: profile?.stage || 'Idea',
          funding: profile?.raised || 0,
          equity: 0,
          visibility: 'Public',
          status: 'active'
        }
      }).catch(() => null);
    }

    let rawBids: any[] = [];
    if (startup) {
      try {
        rawBids = await prisma.investment.findMany({
          where: { startup: startup.id, deletedAt: null },
          orderBy: { createdAt: 'desc' }
        });
      } catch {
        rawBids = [];
      }
    }

    const startupDetails = await getJsonSetting(req.user.id, "startup-details", {});
    const founderDetails = await getJsonSetting(req.user.id, "founder-profile-details", {});

    const reg: any = {
      ...parseRegData(user?.registrationData),
      ...startupDetails,
      ...founderDetails
    };

        const countryId = await resolveId(user?.country || reg.country || "", "Country");
    const userObj = {
      id: user?.id,
      email: user?.email,
      fullName: user?.fullName,
      avatarUrl: user?.avatarUrl || null,
      logo: user?.avatarUrl || null,
      bio: user?.bio || reg.bio || reg.pitch || "",
      phone: user?.phone || reg.phone || reg.mobile || "",
      countryId: countryId,
      city: user?.city || reg.city || "",
      role: user?.role,
      registrationData: reg
    };

    const documents = [
      { id: "doc_bp", name: "Business Plan", url: startup?.businessPlan || profile?.businessPlan || reg.businessPlan || "https://apiai.goexperts.in/uploads/business_plan.pdf", type: "pdf" },
      { id: "doc_pd", name: "Pitch Deck", url: startup?.pitchDeck || profile?.pitchDeck || reg.pitchDeck || "https://apiai.goexperts.in/uploads/pitch_deck.pdf", type: "pdf" }
    ];

    const [resolvedStartupStage, resolvedStartupCat] = await Promise.all([
      resolveMasterOptionsInput(startup?.stage, 'startup_stage'),
      resolveMasterOptionsInput(startup?.category, 'project_category'),
    ]);

    const result: any = {
      ...startup,
      industryId: await resolveId(startup?.industry, "Industry"),
      categoryId: resolvedStartupCat.ids[0] || startup?.category,
      stageId: resolvedStartupStage.ids[0] || startup?.stage,
      documents,
      teamSize: profile?.teamSize ?? (reg.teamSize ? parseInt(reg.teamSize) : 1),
      description: reg.description || reg.pitch || user?.bio || "",
      problemStatement: reg.problemStatement || "",
      solution: reg.solution || "",
      targetCustomers: reg.targetCustomers || "",
      marketSize: reg.marketSize || "",
      businessModel: reg.businessModel || "",
      revenueModel: reg.revenueModel || "",
      currentProgress: reg.currentProgress || "",
      demoLink: reg.demoLink || "",
      user: userObj,
      bids: rawBids
    };

    delete result.industry;
    delete result.category;
    delete result.stage;

    return res.json(successResponse('Startup details retrieved', result));
  } catch (error) { next(error); }
};

export const updateProfile = authUpdateMe;

export const uploadLogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json(errorResponse('No file provided', 'VALIDATION_ERROR'));
    const url = uploadedFileUrl(req.file);
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    return res.status(201).json(successResponse('Logo uploaded', { url }));
  } catch (error) { next(error); }
};

export const uploadCover = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return respondWithUploadedFile(req, res, 'Cover uploaded'); } catch (error) { next(error); }
};

export const getProfileCompletion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id } }),
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } })
    ]);
    const steps = [
      { step: 'Basic Info', done: !!user?.fullName },
      { step: 'Startup Name', done: !!profile?.startupName },
      { step: 'Industry', done: !!profile?.industry },
      { step: 'Stage', done: !!profile?.stage },
      { step: 'Logo', done: !!user?.avatarUrl }
    ];
    const done = steps.filter(s => s.done).length;
    return res.json(successResponse('Profile completion', { percentage: Math.round((done / steps.length) * 100), steps }));
  } catch (error) { next(error); }
};
