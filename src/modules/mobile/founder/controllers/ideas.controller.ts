import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';
import { isSchemaDriftError } from '../../../../common/helpers/prisma-compat.js';

export const createIdea = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startup, industry, category, stage, funding, equity, visibility, pitchDeck, businessPlan, logo, coverUrl } = req.body;

    const parsedFunding = parseFloat(String(funding ?? 0));
    const parsedEquity = parseFloat(String(equity ?? 0));

    if (!startup || !String(startup).trim()) {
      return res.status(400).json(errorResponse('Startup name is required', 'VALIDATION_ERROR'));
    }

    let idea = null;
    try {
      idea = await prisma.startupIdea.create({
        data: {
          founder: req.user.id,
          startup: String(startup).trim(),
          industry: industry ? String(industry).trim() : null,
          category: category ? String(category).trim() : null,
          stage: stage ? String(stage).trim() : null,
          funding: isNaN(parsedFunding) ? 0 : parsedFunding,
          equity: isNaN(parsedEquity) ? 0 : parsedEquity,
          visibility: visibility || 'Public',
          pitchDeck: pitchDeck || null,
          businessPlan: businessPlan || null,
          logo: logo || null,
          coverUrl: coverUrl || null
        }
      });
    } catch (err) {
      if (isSchemaDriftError(err)) {
        const id = `idea_${Date.now()}`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO startup_ideas (id, founder, startup, industry, category, stage, funding, equity, visibility, logo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          id, req.user.id, String(startup).trim(), industry || null, category || null, stage || null, isNaN(parsedFunding) ? 0 : parsedFunding, isNaN(parsedEquity) ? 0 : parsedEquity, visibility || 'Public', logo || null
        );
        idea = { id, founder: req.user.id, startup: String(startup).trim(), industry: industry || null, category: category || null, stage: stage || null, funding: isNaN(parsedFunding) ? 0 : parsedFunding, equity: isNaN(parsedEquity) ? 0 : parsedEquity, visibility: visibility || 'Public', logo: logo || null, pitchDeck: null };
      } else {
        throw err;
      }
    }

    // Notify matching investors in the background
    process.nextTick(async () => {
      try {
        const investors = await prisma.user.findMany({
          where: { role: 'investor', status: 'active' },
          include: { investorProfile: true },
          take: 50
        });

        const ideaInd = (industry || '').toLowerCase();
        const ideaCat = (category || '').toLowerCase();
        const matched = investors.filter(inv => {
          if (!inv.investorProfile) return false;
          const focusAreas = (inv.investorProfile.focusAreas || '').toLowerCase();
          return focusAreas.includes(ideaInd) || focusAreas.includes(ideaCat);
        });

        for (const inv of matched.slice(0, 20)) {
          await NotificationEngine.queueNotification({
            userId: inv.id,
            type: 'new_idea_match',
            title: 'New Startup Idea!',
            message: `A new startup '${startup}' was just posted in your focus area!`,
            channel: 'all'
          });
        }
      } catch (e) {
        console.error('Failed to notify investors of new idea', e);
      }
    });

    return res.status(201).json(successResponse('Startup idea created successfully', idea));
  } catch (error) {
    next(error);
  }
};

export const listIdeas = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    let ideas: any[] = [];
    let total = 0;

    try {
      const founderFilter = {
        founder: req.user.id,
        deletedAt: null
      };

      [ideas, total] = await Promise.all([
        prisma.startupIdea.findMany({
          where: founderFilter,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.startupIdea.count({
          where: founderFilter
        })
      ]);
    } catch {
      try {
        const rawIdeas: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, startup, founder, industry, category, stage, funding, equity, visibility, logo, status, views, created_at as createdAt, updated_at as updatedAt FROM startup_ideas WHERE founder = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          req.user.id, limit, skip
        );
        ideas = rawIdeas.map(i => ({ ...i, pitchDeck: null, businessPlan: null }));
        const totalRaw: any[] = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as cnt FROM startup_ideas WHERE founder = ? AND deleted_at IS NULL`,
          req.user.id
        );
        total = Number(totalRaw[0]?.cnt || 0);
      } catch {
        ideas = [];
        total = 0;
      }
    }

    const singleIdea = ideas[0] || null;

    let responseData: any = null;

    if (singleIdea) {
      let bids: any[] = [];
      try {
        bids = await prisma.investment.findMany({
          where: {
            OR: [
              { startup: singleIdea.id },
              { startup: req.user.id }
            ],
            deletedAt: null
          },
          orderBy: { createdAt: 'desc' }
        });
      } catch {
        bids = [];
      }

      let investorMap: Record<string, any> = {};
      const investorIds = [...new Set(bids.map((b: any) => b.investor))];
      if (investorIds.length > 0) {
        try {
          const investors = await prisma.user.findMany({
            where: { id: { in: investorIds } },
            select: { id: true, fullName: true, avatarUrl: true }
          });
          investors.forEach((inv: any) => {
            investorMap[inv.id] = inv;
          });
        } catch {
          // ignore
        }
      }

      const interestedInvestorsList = bids.map((b: any) => ({
        id: b.id,
        investorId: b.investor,
        investorName: investorMap[b.investor]?.fullName || 'Investor',
        avatarUrl: investorMap[b.investor]?.avatarUrl || null,
        offer: b.offer,
        equity: b.equity,
        status: b.status,
        meetingDate: b.meetingDate || null,
        createdAt: b.createdAt
      }));

      responseData = {
        ...singleIdea,
        interestedInvestors: bids.length,
        interestedInvestorsList
      };
    }

    return res.json({
      success: true,
      message: responseData ? 'Startup idea retrieved' : 'No startup idea found',
      data: responseData
    });
  } catch (error) {
    next(error);
  }
};

export const getIdeaDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let idea: any = null;
    try {
      idea = await prisma.startupIdea.findFirst({
        where: {
          id: req.params.id,
          deletedAt: null,
          founder: req.user.id,
        }
      });
    } catch (err) {
      if (isSchemaDriftError(err)) {
        const raw: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, startup, founder, industry, category, stage, funding, equity, visibility, logo, status, views, created_at as createdAt, updated_at as updatedAt FROM startup_ideas WHERE id = ? AND founder = ? AND deleted_at IS NULL LIMIT 1`,
          req.params.id, req.user.id
        );
        idea = raw[0] ? { ...raw[0], pitchDeck: null, businessPlan: null } : null;
      } else {
        throw err;
      }
    }

    if (!idea) {
      return res.status(404).json(errorResponse('Startup idea not found', 'NOT_FOUND'));
    }

    return res.json(successResponse('Startup idea details', idea));
  } catch (error) {
    next(error);
  }
};

export const updateIdea = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startup, industry, category, stage, funding, equity, visibility, pitchDeck, businessPlan, logo, coverUrl } = req.body;

    const idea = await prisma.startupIdea.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
        founder: req.user.id,
      }
    });

    if (!idea) {
      return res.status(404).json(errorResponse('Startup idea not found', 'NOT_FOUND'));
    }

    const parsedFunding = funding !== undefined ? parseFloat(String(funding)) : undefined;
    const parsedEquity = equity !== undefined ? parseFloat(String(equity)) : undefined;

    const updated = await prisma.startupIdea.update({
      where: { id: req.params.id },
      data: {
        startup: startup !== undefined ? startup : undefined,
        industry: industry !== undefined ? industry : undefined,
        category: category !== undefined ? category : undefined,
        stage: stage !== undefined ? stage : undefined,
        funding: parsedFunding !== undefined && !isNaN(parsedFunding) ? parsedFunding : undefined,
        equity: parsedEquity !== undefined && !isNaN(parsedEquity) ? parsedEquity : undefined,
        visibility: visibility !== undefined ? visibility : undefined,
        pitchDeck: pitchDeck !== undefined ? pitchDeck : undefined,
        businessPlan: businessPlan !== undefined ? businessPlan : undefined,
        logo: logo !== undefined ? logo : undefined,
        coverUrl: coverUrl !== undefined ? coverUrl : undefined
      }
    });

    return res.json(successResponse('Startup idea updated successfully', updated));
  } catch (error) {
    next(error);
  }
};

export const deleteIdea = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const idea = await prisma.startupIdea.findFirst({
      where: {
        id: req.params.id,
        deletedAt: null,
        founder: req.user.id,
      }
    });

    if (!idea) {
      return res.status(404).json(errorResponse('Startup idea not found', 'NOT_FOUND'));
    }

    await prisma.startupIdea.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });

    return res.json(successResponse('Startup idea deleted successfully'));
  } catch (error) {
    next(error);
  }
};
