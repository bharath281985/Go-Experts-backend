import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile, uploadedFileUrl } from '../../../../utils/uploaded-file.js';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, fullName: true, avatarUrl: true, bio: true, phone: true, country: true, city: true, role: true }
    });

    const [profile, firstIdea, allIdeas] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } }).catch(() => null),
      prisma.startupIdea.findFirst({ where: { founder: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' } }).catch(() => null),
      prisma.startupIdea.findMany({ where: { founder: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' } }).catch(() => [])
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

    const startupName = profile?.startupName || firstIdea?.startup || (user?.fullName ? `${user.fullName}'s Startup` : 'My Startup');

    const result = {
      id: profile?.id || firstIdea?.id || `fp_${req.user.id}`,
      userId: req.user.id,
      startupName,
      name: startupName,
      startup: startupName,
      title: firstIdea?.startup || startupName,
      industry: profile?.industry || firstIdea?.industry || 'Technology',
      category: firstIdea?.category || 'General',
      stage: profile?.stage || firstIdea?.stage || 'Idea',
      teamSize: profile?.teamSize || 1,
      raised: profile?.raised || firstIdea?.funding || 0,
      funding: firstIdea?.funding || profile?.raised || 0,
      equity: firstIdea?.equity || 0,
      visibility: firstIdea?.visibility || 'Public',
      pitchDeck: firstIdea?.pitchDeck || profile?.pitchDeck || "https://apiai.goexperts.in/uploads/pitch_deck.pdf",
      pitchDeckUrl: firstIdea?.pitchDeck || profile?.pitchDeck || "https://apiai.goexperts.in/uploads/pitch_deck.pdf",
      businessPlan: firstIdea?.businessPlan || profile?.businessPlan || "https://apiai.goexperts.in/uploads/business_plan.pdf",
      businessPlanDoc: firstIdea?.businessPlan || profile?.businessPlan || "https://apiai.goexperts.in/uploads/business_plan.pdf",
      businessPlanUrl: firstIdea?.businessPlan || profile?.businessPlan || "https://apiai.goexperts.in/uploads/business_plan.pdf",
      documents: [
        { id: "doc_bp", name: "Business Plan", url: firstIdea?.businessPlan || profile?.businessPlan || "https://apiai.goexperts.in/uploads/business_plan.pdf", type: "pdf" },
        { id: "doc_pd", name: "Pitch Deck", url: firstIdea?.pitchDeck || profile?.pitchDeck || "https://apiai.goexperts.in/uploads/pitch_deck.pdf", type: "pdf" }
      ],
      logo: user?.avatarUrl || firstIdea?.logo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user.id}`,
      avatarUrl: user?.avatarUrl || firstIdea?.logo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.user.id}`,
      coverUrl: firstIdea?.coverUrl || "https://apiai.goexperts.in/uploads/default_cover.png",
      createdAt: profile?.createdAt || firstIdea?.createdAt || new Date().toISOString(),
      updatedAt: profile?.updatedAt || firstIdea?.updatedAt || new Date().toISOString(),
      user: user || { id: req.user.id, fullName: 'Founder' },
      bids: formattedBids,
      interestedInvestors: formattedBids.length,
      interestedInvestorsList: formattedBids
    };

    return res.json(successResponse('Profile retrieved', result));
  } catch (error) { next(error); }
};

export const getStartup = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, fullName: true, email: true, avatarUrl: true }
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

    return res.json(successResponse('Startup details retrieved', startup));
  } catch (error) { next(error); }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      startupName, name, startup, title,
      industry, category, stage, teamSize, raised, funding, equity, visibility,
      pitchDeck, pitchDeckUrl, businessPlan, businessPlanDoc, businessPlanUrl,
      logo, avatarUrl, coverUrl,
      fullName, bio, phone, phoneCode, phoneNumber, country, city, location
    } = req.body;

    const nameVal = startupName || name || startup || title;
    const raisedVal = raised !== undefined ? parseFloat(raised) : (funding !== undefined ? parseFloat(funding) : undefined);
    const teamSizeVal = teamSize !== undefined ? parseInt(teamSize) : undefined;
    const equityVal = equity !== undefined ? parseFloat(equity) : undefined;
    const cityVal = city || location;
    const pitchDeckVal = pitchDeck || pitchDeckUrl;
    const businessPlanVal = businessPlan || businessPlanDoc || businessPlanUrl;
    const logoVal = logo || avatarUrl;

    let fullPhone = phone;
    if (!fullPhone && phoneNumber) {
      fullPhone = phoneCode ? `${phoneCode}${phoneNumber}` : phoneNumber;
    }

    let uploadedUrl: string | undefined;
    if (req.file) {
      uploadedUrl = uploadedFileUrl(req.file);
    }

    await prisma.founderProfile.upsert({
      where: { userId: req.user.id },
      update: {
        startupName: nameVal || undefined,
        industry: industry || undefined,
        stage: stage || undefined,
        teamSize: teamSizeVal,
        raised: raisedVal
      },
      create: {
        userId: req.user.id,
        startupName: nameVal || 'My Startup',
        industry: industry || 'Technology',
        stage: stage || 'Idea',
        teamSize: teamSizeVal || 1,
        raised: raisedVal || 0
      }
    }).catch(() => null);

    const userDataToUpdate: any = {};
    if (fullName) userDataToUpdate.fullName = fullName;
    if (bio !== undefined) userDataToUpdate.bio = bio;
    if (fullPhone) userDataToUpdate.phone = fullPhone;
    if (country) userDataToUpdate.country = country;
    if (cityVal) userDataToUpdate.city = cityVal;
    if (logoVal) userDataToUpdate.avatarUrl = logoVal;
    if (uploadedUrl && req.file?.mimetype.startsWith('image/')) userDataToUpdate.avatarUrl = uploadedUrl;

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
    if (stage) ideaDataToUpdate.stage = stage;
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
          stage: stage || 'Idea',
          funding: raisedVal || 0,
          equity: equityVal || 0,
          visibility: visibility || 'Public',
          pitchDeck: pitchDeckVal || null,
          businessPlan: businessPlanVal || null,
          status: 'active'
        }
      }).catch(() => null);
    }

    return getProfile(req, res, next);
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
