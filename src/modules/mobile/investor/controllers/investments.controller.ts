import { Response, NextFunction } from 'express';
import { readList, formatStartupResponse, loadRelatedDataForIdeas } from './startups.controller.js';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';
import { sendEmail } from '../../../../services/mobile/email.service.js';

const resolveStartupIdea = (startupId: string) => prisma.startupIdea.findFirst({
  where: {
    OR: [
      { id: startupId },
      { founder: startupId },
      { startup: startupId },
    ],
  },
});

const resolveFounderUser = (founder: string) => prisma.user.findFirst({
  where: {
    OR: [{ id: founder }, { email: founder }, { fullName: founder }],
    role: 'founder',
  },
  select: { id: true, fullName: true, email: true },
});

const notifyFounder = async (
  founderUser: { id: string; email: string; fullName: string },
  type: string,
  title: string,
  message: string,
) => {
  await Promise.allSettled([
    NotificationEngine.queueNotification({
      userId: founderUser.id,
      type,
      title,
      message,
      channel: 'in_app',
    }),
    sendEmail(
      founderUser.email,
      title,
      `<p>Hello ${founderUser.fullName || 'Founder'},</p><p>${message}</p><p>Log in to Go Experts to view the details.</p>`,
    ),
  ]);
};

export const listInvestments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;

    let baseWhere: any;
    if (req.user?.role === 'founder') {
      const founderIdeas = await prisma.startupIdea.findMany({
        where: { founder: req.user.id },
        select: { id: true, startup: true },
      });
      const ideaIds = founderIdeas.map(f => f.id);
      const ideaNames = founderIdeas.map(f => f.startup).filter(Boolean);
      baseWhere = {
        OR: [
          { startup: req.user.id },
          { startup: { in: [...ideaIds, ...ideaNames] } },
          { investor: req.user.id },
        ],
      };
    } else {
      baseWhere = {
        OR: [
          { investor: req.user.id },
          { startup: req.user.id },
        ],
      };
    }

    const where: any = status
      ? { AND: [baseWhere, { status }] }
      : { AND: [baseWhere, { status: { notIn: ['Cancelled', 'Closed'] } }] };

    const [investments, total, watchlist] = await Promise.all([
      prisma.investment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.investment.count({ where }),
      readList(req.user.id),
    ]);

    const startupKeys = [...new Set(investments.map(i => i.startup).filter(Boolean))];
    let startups: any[] = [];
    if (startupKeys.length > 0) {
      startups = await prisma.startupIdea.findMany({
        where: {
          OR: [
            { id: { in: startupKeys } },
            { founder: { in: startupKeys } },
            { startup: { in: startupKeys } },
          ],
        },
      });
    }

    const userIdsToFetch = [...new Set([
      ...startupKeys,
      ...startups.map(s => s.founder).filter(Boolean),
      ...investments.map(i => (i as any).founder || (i as any).founderId).filter(Boolean),
    ])];

    const [fetchedUsers, fetchedFounderProfiles] = await Promise.all([
      userIdsToFetch.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIdsToFetch } },
            select: { id: true, fullName: true, avatarUrl: true, city: true, country: true, role: true },
          })
        : [],
      userIdsToFetch.length > 0
        ? prisma.founderProfile.findMany({ where: { userId: { in: userIdsToFetch } } })
        : [],
    ]);

    const directUserMap = new Map<string, any>(fetchedUsers.map((u: any): [string, any] => [u.id, u]));
    const directFpMap = new Map<string, any>(fetchedFounderProfiles.map((f: any): [string, any] => [f.userId, f]));

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(startups);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(startupKeys);

    const enriched = investments.map(inv => {
      const idea = startups.find(s =>
        s.id === inv.startup ||
        s.founder === inv.startup ||
        s.startup === inv.startup ||
        (s.startup && inv.startup && s.startup.toLowerCase() === inv.startup.toLowerCase())
      );
      const founderUser = (idea ? userMap.get(idea.founder) : null) || directUserMap.get(inv.startup) || null;
      const fp = (idea ? fpMap.get(idea.founder) : null) || directFpMap.get(inv.startup) || null;
      const details = idea
        ? formatStartupResponse(idea, founderUser, fp, savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap)
        : null;

      const resolvedStartupName =
        idea?.startup ||
        details?.startup ||
        fp?.companyName ||
        (founderUser?.role === 'founder' ? `${founderUser.fullName}'s Startup` : null) ||
        (inv.startup && !inv.startup.includes('-') ? inv.startup : 'Startup');
      const resolvedStartupLogo = idea?.logo || details?.logo || fp?.logo || founderUser?.avatarUrl || null;
      const resolvedFounderName = founderUser?.fullName || details?.user?.fullName || 'Founder';
      const resolvedFounderId = idea?.founder || founderUser?.id || details?.user?.id || null;
      const resolvedStage = details?.stageName || details?.stage?.name || idea?.stage || fp?.stage || 'MVP';

      return {
        ...inv,
        startup: details || (idea ? { id: idea.id, name: idea.startup, logo: idea.logo, stage: idea.stage } : { id: inv.startup, name: resolvedStartupName, logo: resolvedStartupLogo, stage: resolvedStage }),
        startupId: idea?.id || inv.startup,
        startupName: resolvedStartupName,
        startupLogo: resolvedStartupLogo,
        founderName: resolvedFounderName,
        founderId: resolvedFounderId,
        stage: resolvedStage,
        startupDetails: details,
      };
    });

    return res.json(successResponse('Investments retrieved', enriched, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getInvestment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investment = await prisma.investment.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { investor: req.user.id },
          { startup: req.user.id },
        ],
      },
    });
    if (!investment) return res.status(404).json(successResponse('Investment not found', null));

    const idea = await resolveStartupIdea(investment.startup).catch(() => null);
    let details = null;

    if (idea) {
      const watchlist = await readList(req.user.id);
      const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas([idea]);
      const savedIds = new Set<string>(watchlist.map(w => w.startupId));
      const investedIds = new Set<string>([idea.id]);
      details = formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, true, platformRaisedMap);
    }

    const founderUser = idea ? (await resolveFounderUser(idea.founder).catch(() => null)) : (await resolveFounderUser(investment.startup).catch(() => null));
    const fp = founderUser ? await prisma.founderProfile.findFirst({ where: { userId: founderUser.id } }).catch(() => null) : null;

    const resolvedStartupName =
      idea?.startup ||
      details?.startup ||
      fp?.companyName ||
      (founderUser?.role === 'founder' ? `${founderUser.fullName}'s Startup` : null) ||
      (investment.startup && !investment.startup.includes('-') ? investment.startup : 'Startup');
    const resolvedStartupLogo = idea?.logo || details?.logo || fp?.logo || founderUser?.avatarUrl || null;
    const resolvedFounderName = founderUser?.fullName || details?.user?.fullName || 'Founder';
    const resolvedFounderId = idea?.founder || founderUser?.id || details?.user?.id || null;
    const resolvedStage = details?.stageName || details?.stage?.name || idea?.stage || fp?.stage || 'MVP';

    return res.json(successResponse('Investment details', {
      ...investment,
      startup: details || (idea ? { id: idea.id, name: idea.startup, logo: idea.logo, stage: idea.stage } : { id: investment.startup, name: resolvedStartupName, logo: resolvedStartupLogo, stage: resolvedStage }),
      startupId: idea?.id || investment.startup,
      startupName: resolvedStartupName,
      startupLogo: resolvedStartupLogo,
      founderName: resolvedFounderName,
      founderId: resolvedFounderId,
      stage: resolvedStage,
      startupDetails: details,
    }));
  } catch (error) { next(error); }
};

export const expressInterest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startupId, offer, amount, equity, message, meetingDate } = req.body;

    const idea = await resolveStartupIdea(String(startupId || ''));
    if (!idea) return res.status(404).json(errorResponse('Startup not found', 'NOT_FOUND'));
    const founderUser = await resolveFounderUser(idea.founder);
    const investmentStartupId = idea.id;

    // Fallback logic to prevent NaN crashes
    const parsedOffer = parseFloat(offer ?? amount ?? 0);
    const parsedEquity = parseFloat(equity ?? 0);
    const finalOffer = isNaN(parsedOffer) ? 0 : parsedOffer;
    const finalEquity = isNaN(parsedEquity) ? 0 : parsedEquity;

    const existing = await prisma.investment.findFirst({
      where: { investor: req.user.id, startup: { in: [idea.id, investmentStartupId] } }
    });

    let investment;
    if (existing) {
      investment = await prisma.investment.update({
        where: { id: existing.id },
        data: {
          offer: finalOffer,
          equity: finalEquity,
          meetingDate: meetingDate || null,
          status: 'Pending',
          docs: message || 'View folder'
        }
      });
    } else {
      investment = await prisma.investment.create({
        data: {
          investor: req.user.id,
          startup: investmentStartupId,
          offer: finalOffer,
          equity: finalEquity,
          meetingDate: meetingDate || null,
          status: 'Pending',
          docs: message || 'View folder'
        }
      });
    }

    if (founderUser) {
      await notifyFounder(
        founderUser,
        'investment_interest',
        'New Investment Interest',
        `${req.user.fullName || 'An investor'} has expressed interest in your startup!`,
      );
    }

    return res.status(201).json(successResponse('Interest expressed', {
      ...investment,
      startup: idea.id,
      startupId: idea.id,
    }));
  } catch (error) { next(error); }
};

export const makeOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startupId, offer, amount, equity, message } = req.body;

    const idea = await resolveStartupIdea(String(startupId || ''));
    if (!idea) return res.status(404).json(errorResponse('Startup not found', 'NOT_FOUND'));
    const founderUser = await resolveFounderUser(idea.founder);
    const investmentStartupId = idea.id;

    const parsedOffer = parseFloat(offer ?? amount ?? 0);
    const parsedEquity = parseFloat(equity ?? 0);
    const finalOffer = isNaN(parsedOffer) ? 0 : parsedOffer;
    const finalEquity = isNaN(parsedEquity) ? 0 : parsedEquity;

    const existing = await prisma.investment.findFirst({
      where: { investor: req.user.id, startup: { in: [idea.id, investmentStartupId] } }
    });

    let investment;
    if (existing) {
      investment = await prisma.investment.update({
        where: { id: existing.id },
        data: {
          offer: finalOffer,
          equity: finalEquity,
          status: 'Offer',
          docs: message || existing.docs,
        }
      });
    } else {
      investment = await prisma.investment.create({
        data: {
          investor: req.user.id,
          startup: investmentStartupId,
          offer: finalOffer,
          equity: finalEquity,
          status: 'Offer',
          docs: message || 'View folder',
        }
      });
    }

    if (founderUser) {
      await notifyFounder(
        founderUser,
        'investment_offer',
        'New Investment Offer',
        `${req.user.fullName || 'An investor'} has made a direct offer for your startup!`,
      );
    }

    return res.status(201).json(successResponse('Offer made', {
      ...investment,
      startup: idea.id,
      startupId: idea.id,
    }));
  } catch (error) { next(error); }
};

export const updateInvestmentStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    await prisma.investment.updateMany({ where: { id: req.params.id, investor: req.user.id }, data: { status } });
    return res.json(successResponse('Investment status updated'));
  } catch (error) { next(error); }
};

export const cancelInvestment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investment = await prisma.investment.findFirst({
      where: {
        OR: [{ id: req.params.id }, { startup: req.params.id }],
        investor: req.user.id,
        status: { in: ['Pending', 'Offer'] },
      },
    });

    if (!investment) {
      return res.status(404).json(errorResponse('Investment not found', 'NOT_FOUND'));
    }

    const idea = await resolveStartupIdea(investment.startup);
    const founderUser = idea ? await resolveFounderUser(idea.founder) : null;

    await prisma.investment.deleteMany({
      where: {
        OR: [{ id: req.params.id }, { startup: req.params.id }],
        investor: req.user.id,
        status: { in: ['Pending', 'Offer'] }
      }
    });

    if (founderUser) {
      await notifyFounder(
        founderUser,
        'investment_withdrawn',
        'Investment Withdrawn',
        `${req.user.fullName || 'An investor'} has withdrawn their investment interest.`,
      );
    }

    return res.json(successResponse('Investment withdrawn and removed successfully'));
  } catch (error) { next(error); }
};

export const getInvestmentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.investment.findMany({ where: { investor: req.user.id, status: { in: ['Closed', 'Completed', 'Cancelled'] } }, orderBy: { createdAt: 'desc' } });
    return res.json(successResponse('Investment history', history));
  } catch (error) { next(error); }
};
