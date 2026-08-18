import { Response, NextFunction } from 'express';
import { readList, formatStartupResponse, loadRelatedDataForIdeas } from './startups.controller.js';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

const resolveStartupIdea = (startupId: string) => prisma.startupIdea.findFirst({
  where: {
    OR: [{ id: startupId }, { founder: startupId }],
    deletedAt: null,
  },
});

export const listInvestments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const where: any = { investor: req.user.id };
    if (status) {
      where.status = status;
    } else {
      where.status = { notIn: ['Cancelled', 'Closed'] };
    }

    const [investments, total, watchlist] = await Promise.all([
      prisma.investment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.investment.count({ where }),
      readList(req.user.id)
    ]);

    const startupIds = [...new Set(investments.map(i => i.startup).filter(Boolean))];
    let startups: any[] = [];
    if (startupIds.length > 0) {
      startups = await prisma.startupIdea.findMany({
        where: { OR: [{ id: { in: startupIds } }, { founder: { in: startupIds } }], deletedAt: null },
      });
    }

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(startups);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(startupIds);

    const enriched = investments.map(inv => {
      const idea = startups.find(s => s.id === inv.startup || s.founder === inv.startup);
      const details = idea ? formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap) : null;
      return { ...inv, startup: idea?.id || inv.startup, startupId: idea?.id || inv.startup, startupDetails: details };
    });

    return res.json(successResponse('Investments retrieved', enriched, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getInvestment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investment = await prisma.investment.findFirst({ where: { id: req.params.id, investor: req.user.id } });
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

    return res.json(successResponse('Investment details', {
      ...investment,
      startup: idea?.id || investment.startup,
      startupId: idea?.id || investment.startup,
      startupDetails: details,
    }));
  } catch (error) { next(error); }
};

export const expressInterest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startupId, offer, amount, equity, message, meetingDate } = req.body;

    const idea = await resolveStartupIdea(String(startupId || ''));
    if (!idea) return res.status(404).json(errorResponse('Startup not found', 'NOT_FOUND'));
    const investmentStartupId = idea.founder;

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

    if (idea && idea.founder) {
      await NotificationEngine.queueNotification({
        userId: idea.founder,
        type: 'investment_interest',
        title: 'New Investment Interest',
        message: `${req.user.fullName || 'An investor'} has expressed interest in your startup!`,
        channel: 'all'
      });
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
    const investmentStartupId = idea.founder;

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

    if (idea && idea.founder) {
      await NotificationEngine.queueNotification({
        userId: idea.founder,
        type: 'investment_offer',
        title: 'New Investment Offer',
        message: `${req.user.fullName || 'An investor'} has made a direct offer for your startup!`,
        channel: 'all'
      });
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
    await prisma.investment.deleteMany({
      where: {
        OR: [{ id: req.params.id }, { startup: req.params.id }],
        investor: req.user.id,
        status: { in: ['Pending', 'Offer'] }
      }
    });

    const idea = await prisma.startupIdea.findUnique({ where: { id: req.params.id } });
    if (idea && idea.founder) {
      await NotificationEngine.queueNotification({
        userId: idea.founder,
        type: 'investment_withdrawn',
        title: 'Investment Withdrawn',
        message: `${req.user.fullName || 'An investor'} has withdrawn their investment interest.`,
        channel: 'all'
      });
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
