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

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, fullName: true, avatarUrl: true, bio: true, phone: true, country: true, city: true, role: true, isVerified: true, registrationData: true }
    });

    const reg = parseRegData(user?.registrationData);

    const [profile, firstIdea, allIdeas] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } }).catch(() => null),
      prisma.startupIdea.findFirst({ where: { founder: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' } }).catch(() => null),
      prisma.startupIdea.findMany({ where: { founder: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' } }).catch(() => [])
    ]);

    const stageVal = profile?.stage || firstIdea?.stage || reg.stage || reg.fundingStage || 'Idea';
    const founderTypeVal = reg.founderType || reg.type || 'Co-Founder';
    const raisedVal = profile?.raised || firstIdea?.funding || (reg.raised != null ? parseFloat(reg.raised) : (reg.funding != null ? parseFloat(reg.funding) : (reg.fundingRequired != null ? parseFloat(reg.fundingRequired) : 0)));
    const equityVal = firstIdea?.equity || (reg.equity != null ? parseFloat(reg.equity) : (reg.equityOffered != null ? parseFloat(reg.equityOffered) : 0));

    const [resolvedStage, resolvedFounderType, resolvedCategory] = await Promise.all([
      resolveMasterOptionsInput(stageVal, 'startup_stage'),
      resolveMasterOptionsInput(founderTypeVal, 'founder_type'),
      resolveMasterOptionsInput(firstIdea?.category || reg.category || 'General', 'project_category'),
    ]);

    const targetStartupIds = [
      req.user.id,
      profile?.id,
      firstIdea?.id,
      ...allIdeas.map(i => i.id)
    ].filter(Boolean);

    let rawBids: any[] = [];
    try {
      rawBids = await prisma.investment.findMany({
        where: {
          startup: { in: targetStartupIds },
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch {
      rawBids = [];
    }

    const investorIds = [...new Set(rawBids.map((b: any) => b.investor).filter(Boolean))];
    let investorMap: Record<string, any> = {};
    if (investorIds.length > 0) {
      try {
        const investors = await prisma.user.findMany({
          where: { id: { in: investorIds } },
          select: { id: true, fullName: true, avatarUrl: true, email: true }
        });
        investors.forEach(inv => { investorMap[inv.id] = inv; });
      } catch {
        investorMap = {};
      }
    }

    const formattedBids = rawBids.map((b: any) => ({
      id: b.id,
      investorId: b.investor,
      investorName: investorMap[b.investor]?.fullName || 'Investor',
      avatarUrl: investorMap[b.investor]?.avatarUrl || null,
      offer: b.offer || 0,
      equity: b.equity || 0,
      status: b.status || 'Pending',
      meetingDate: b.meetingDate || null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      investorProfile: investorMap[b.investor] || null
    }));

    const startupName = profile?.startupName || firstIdea?.startup || reg.startupName || reg.startup || (user?.fullName ? `${user.fullName}'s Startup` : 'My Startup');

    const countryId = await resolveId(user?.country || reg.country || "", "Country");
    const industryId = await resolveId(profile?.industry || firstIdea?.industry || reg.industry || 'Technology', "Industry");
    const categoryId = resolvedCategory.ids[0] || firstIdea?.category || reg.category || 'General';

    const result = {
      id: profile?.id || firstIdea?.id || `fp_${req.user.id}`,
      userId: req.user.id,
      fullName: user?.fullName || reg.fullName || "",
      email: user?.email || reg.email || "",
      phone: user?.phone || reg.phone || reg.mobile || "",
      isVerified: user?.isVerified || false,
      countryCode: reg.countryCode || "IN",
      city: user?.city || reg.city || "",
      state: reg.state || reg.stateCode || "",
      countryId: countryId,
      bio: user?.bio || reg.bio || reg.pitch || "",
      founderTypeId: resolvedFounderType.ids[0] || founderTypeVal,
      skills: reg.skills || "",
      experience: reg.experience || "",
      education: reg.education || "",
      linkedin: reg.linkedin || reg.linkedinUrl || "",
      website: reg.website || reg.websiteUrl || "",
      lookingFor: Array.isArray(reg.lookingFor) ? reg.lookingFor : (typeof reg.lookingFor === 'string' ? reg.lookingFor.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
      subscriptionPlan: reg.subscriptionPlan || "",
      panNumber: reg.panNumber || "",
      aadhaarNumber: reg.aadhaarNumber || "",
      idDocument: reg.idDocument || reg.idDocumentUrl || "",
      avatarUrl: user?.avatarUrl || reg.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user.id}`,
      createdAt: profile?.createdAt || firstIdea?.createdAt || new Date().toISOString(),
      updatedAt: profile?.updatedAt || firstIdea?.updatedAt || new Date().toISOString()
    };

    return res.json(successResponse('Profile retrieved', result));
  } catch (error) { next(error); }
};

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

    const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user.id}`;
    const countryId = await resolveId(user?.country || reg.country || "", "Country");
    const userObj = {
      id: user?.id,
      email: user?.email,
      fullName: user?.fullName,
      avatarUrl: user?.avatarUrl || dicebearUrl,
      logo: user?.avatarUrl || dicebearUrl,
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

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    const {
      startupName, name, startup, title,
      industry, category, subCategory, stage, fundingStage, stageId, teamSize, raised, funding, fundingRequired, equity, equityOffered, visibility,
      pitchDeck, pitchDeckUrl, businessPlan, businessPlanDoc, businessPlanUrl, demoLink,
      logo, avatarUrl, coverUrl,
      fullName, bio, pitch, phone, phoneCode, phoneNumber, mobile, country, countryCode, state, stateCode, city, location,
      founderType, founderTypeId, skills, experience, education, linkedin, linkedinUrl, website, websiteUrl,
      shortPitch, description, problemStatement, solution, targetCustomers, marketSize, businessModel, revenueModel, currentProgress,
      lookingFor, subscriptionPlan, panNumber, aadhaarNumber, idDocument, idDocumentUrl
    } = b;

    const nameVal = startupName || name || startup || title;
    const stageVal = stage || fundingStage;
    const raisedVal = raised !== undefined && raised !== null ? parseFloat(raised) : (funding !== undefined && funding !== null ? parseFloat(funding) : (fundingRequired !== undefined && fundingRequired !== null ? parseFloat(fundingRequired) : undefined));
    const teamSizeVal = teamSize !== undefined && teamSize !== null ? parseInt(teamSize) : undefined;
    const equityVal = equity !== undefined && equity !== null ? parseFloat(equity) : (equityOffered !== undefined && equityOffered !== null ? parseFloat(equityOffered) : undefined);
    const cityVal = city || location;
    const pitchDeckVal = pitchDeck || pitchDeckUrl;
    const businessPlanVal = businessPlan || businessPlanDoc || businessPlanUrl;
    let logoVal = logo || avatarUrl;
    const bioVal = bio !== undefined ? bio : pitch;
    const linkedinVal = linkedin || linkedinUrl;
    const websiteVal = website || websiteUrl;
    let idDocumentVal = idDocument || idDocumentUrl;

    let fullPhone = phone || mobile;
    if (!fullPhone && phoneNumber) {
      fullPhone = phoneCode ? `${phoneCode}${phoneNumber}` : phoneNumber;
    }

    let uploadedUrl: string | undefined;
    if (req.file) {
      uploadedUrl = uploadedFileUrl(req.file);
      if (req.file.mimetype && req.file.mimetype.startsWith('image/')) {
        logoVal = uploadedUrl;
      } else {
        if (!pitchDeckVal) {
          b.pitchDeck = uploadedUrl;
        }
      }
    }

    await prisma.founderProfile.upsert({
      where: { userId: req.user.id },
      update: {
        startupName: nameVal || undefined,
        industry: industry || undefined,
        stage: stageVal || undefined,
        teamSize: teamSizeVal,
        raised: raisedVal
      },
      create: {
        userId: req.user.id,
        startupName: nameVal || 'My Startup',
        industry: industry || 'Technology',
        stage: stageVal || 'Idea',
        teamSize: teamSizeVal || 1,
        raised: raisedVal || 0
      }
    }).catch(() => null);

    const existingUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    const currentReg = parseRegData(existingUser?.registrationData);

    const updatedReg = {
      ...currentReg,
      fullName: fullName !== undefined ? fullName : currentReg.fullName,
      phone: fullPhone !== undefined ? fullPhone : currentReg.phone,
      mobile: mobile !== undefined ? mobile : (fullPhone !== undefined ? fullPhone : currentReg.mobile),
      phoneNumber: phoneNumber !== undefined ? phoneNumber : currentReg.phoneNumber,
      phoneCode: phoneCode !== undefined ? phoneCode : currentReg.phoneCode,
      countryCode: countryCode !== undefined ? countryCode : currentReg.countryCode,
      bio: bioVal !== undefined ? bioVal : currentReg.bio,
      pitch: pitch !== undefined ? pitch : (bioVal !== undefined ? bioVal : currentReg.pitch),
      city: cityVal !== undefined ? cityVal : currentReg.city,
      state: state !== undefined ? state : (stateCode !== undefined ? stateCode : currentReg.state),
      stateCode: stateCode !== undefined ? stateCode : (state !== undefined ? state : currentReg.stateCode),
      country: country !== undefined ? country : currentReg.country,
      founderType: founderType !== undefined ? founderType : currentReg.founderType,
      founderTypeId: founderTypeId !== undefined ? founderTypeId : currentReg.founderTypeId,
      skills: skills !== undefined ? skills : currentReg.skills,
      experience: experience !== undefined ? experience : currentReg.experience,
      education: education !== undefined ? education : currentReg.education,
      linkedin: linkedinVal !== undefined ? linkedinVal : currentReg.linkedin,
      website: websiteVal !== undefined ? websiteVal : currentReg.website,
      teamSize: teamSizeVal !== undefined ? teamSizeVal : currentReg.teamSize,
      startupName: nameVal !== undefined ? nameVal : currentReg.startupName,
      industry: industry !== undefined ? industry : currentReg.industry,
      category: category !== undefined ? category : currentReg.category,
      subCategory: subCategory !== undefined ? subCategory : currentReg.subCategory,
      stage: stageVal !== undefined ? stageVal : currentReg.stage,
      fundingStage: stageVal !== undefined ? stageVal : currentReg.fundingStage,
      raised: raisedVal !== undefined ? raisedVal : currentReg.raised,
      funding: raisedVal !== undefined ? raisedVal : currentReg.funding,
      fundingRequired: fundingRequired !== undefined ? fundingRequired : currentReg.fundingRequired,
      equity: equityVal !== undefined ? equityVal : currentReg.equity,
      equityOffered: equityOffered !== undefined ? equityOffered : currentReg.equityOffered,
      visibility: visibility !== undefined ? visibility : currentReg.visibility,
      shortPitch: shortPitch !== undefined ? shortPitch : currentReg.shortPitch,
      description: description !== undefined ? description : currentReg.description,
      problemStatement: problemStatement !== undefined ? problemStatement : currentReg.problemStatement,
      solution: solution !== undefined ? solution : currentReg.solution,
      targetCustomers: targetCustomers !== undefined ? targetCustomers : currentReg.targetCustomers,
      marketSize: marketSize !== undefined ? marketSize : currentReg.marketSize,
      businessModel: businessModel !== undefined ? businessModel : currentReg.businessModel,
      revenueModel: revenueModel !== undefined ? revenueModel : currentReg.revenueModel,
      currentProgress: currentProgress !== undefined ? currentProgress : currentReg.currentProgress,
      demoLink: demoLink !== undefined ? demoLink : currentReg.demoLink,
      pitchDeck: pitchDeckVal !== undefined ? pitchDeckVal : currentReg.pitchDeck,
      pitchDeckUrl: pitchDeckVal !== undefined ? pitchDeckVal : currentReg.pitchDeckUrl,
      businessPlan: businessPlanVal !== undefined ? businessPlanVal : currentReg.businessPlan,
      businessPlanUrl: businessPlanVal !== undefined ? businessPlanVal : currentReg.businessPlanUrl,
      lookingFor: lookingFor !== undefined ? lookingFor : currentReg.lookingFor,
      subscriptionPlan: subscriptionPlan !== undefined ? subscriptionPlan : currentReg.subscriptionPlan,
      panNumber: panNumber !== undefined ? panNumber : currentReg.panNumber,
      aadhaarNumber: aadhaarNumber !== undefined ? aadhaarNumber : currentReg.aadhaarNumber,
      idDocument: idDocumentVal !== undefined ? idDocumentVal : currentReg.idDocument,
      idDocumentUrl: idDocumentVal !== undefined ? idDocumentVal : currentReg.idDocumentUrl,
    };

    const userDataToUpdate: any = {
      registrationData: updatedReg
    };
    if (fullName) userDataToUpdate.fullName = fullName;
    if (bioVal !== undefined) userDataToUpdate.bio = bioVal;
    if (fullPhone) userDataToUpdate.phone = fullPhone;
    if (country) userDataToUpdate.country = country;
    if (cityVal) userDataToUpdate.city = cityVal;
    if (logoVal) userDataToUpdate.avatarUrl = logoVal;

    if (Object.keys(userDataToUpdate).length > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: userDataToUpdate
      }).catch(() => null);
    }

    const existingIdea = await prisma.startupIdea.findFirst({
      where: { founder: req.user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });

    const ideaDataToUpdate: any = {};
    if (nameVal) ideaDataToUpdate.startup = nameVal;
    if (industry) ideaDataToUpdate.industry = industry;
    if (category) ideaDataToUpdate.category = category;
    if (stageVal) ideaDataToUpdate.stage = stageVal;
    if (raisedVal !== undefined) ideaDataToUpdate.funding = raisedVal;
    if (equityVal !== undefined) ideaDataToUpdate.equity = equityVal;
    if (visibility) ideaDataToUpdate.visibility = visibility;
    if (pitchDeckVal) ideaDataToUpdate.pitchDeck = pitchDeckVal;
    if (businessPlanVal) ideaDataToUpdate.businessPlan = businessPlanVal;
    if (logoVal) ideaDataToUpdate.logo = logoVal;
    if (coverUrl) ideaDataToUpdate.coverUrl = coverUrl;
    if (uploadedUrl && req.file?.mimetype.startsWith('image/')) ideaDataToUpdate.logo = uploadedUrl;
    if (uploadedUrl && !req.file?.mimetype.startsWith('image/')) ideaDataToUpdate.businessPlan = uploadedUrl;

    if (existingIdea) {
      if (Object.keys(ideaDataToUpdate).length > 0) {
        await prisma.startupIdea.update({
          where: { id: existingIdea.id },
          data: ideaDataToUpdate
        }).catch(() => null);
      }
    } else {
      await prisma.startupIdea.create({
        data: {
          founder: req.user.id,
          startup: nameVal || 'My Startup',
          industry: industry || 'Technology',
          category: category || 'General',
          stage: stageVal || 'Idea',
          funding: raisedVal || 0,
          equity: equityVal || 0,
          visibility: visibility || 'Public',
          pitchDeck: pitchDeckVal || null,
          businessPlan: businessPlanVal || null,
          status: 'active'
        }
      }).catch(() => null);
    }

    return res.json(successResponse('Profile updated successfully'));
  } catch (error) { next(error); }
};

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
