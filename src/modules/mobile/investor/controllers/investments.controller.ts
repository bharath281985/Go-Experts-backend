import { Response, NextFunction } from 'express';
import { readList, formatStartupResponse, loadRelatedDataForIdeas } from './startups.controller.js';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

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
      startups = await prisma.startupIdea.findMany({ where: { id: { in: startupIds } } });
    }

    const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas(startups);
    const savedIds = new Set<string>(watchlist.map(w => w.startupId));
    const investedIds = new Set<string>(startupIds);

    const enriched = investments.map(inv => {
      const idea = startups.find(s => s.id === inv.startup);
      const details = idea ? formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, false, platformRaisedMap) : null;
      return { ...inv, startupDetails: details };
    });

    return res.json(successResponse('Investments retrieved', enriched, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getInvestment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investment = await prisma.investment.findFirst({ where: { id: req.params.id, investor: req.user.id } });
    if (!investment) return res.status(404).json(successResponse('Investment not found', null));

    const idea = await prisma.startupIdea.findUnique({ where: { id: investment.startup } }).catch(() => null);
    let details = null;

    if (idea) {
      const watchlist = await readList(req.user.id);
      const { userMap, fpMap, industryMap, optionMap, platformRaisedMap } = await loadRelatedDataForIdeas([idea]);
      const savedIds = new Set<string>(watchlist.map(w => w.startupId));
      const investedIds = new Set<string>([idea.id]);
      details = formatStartupResponse(idea, userMap.get(idea.founder), fpMap.get(idea.founder), savedIds, investedIds, industryMap, optionMap, true, platformRaisedMap);
    }

    return res.json(successResponse('Investment details', { ...investment, startupDetails: details }));
  } catch (error) { next(error); }
};

export const expressInterest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startupId, offer, amount, equity, message, meetingDate } = req.body;

    // Fallback logic to prevent NaN crashes
    const parsedOffer = parseFloat(offer ?? amount ?? 0);
    const parsedEquity = parseFloat(equity ?? 0);
    const finalOffer = isNaN(parsedOffer) ? 0 : parsedOffer;
    const finalEquity = isNaN(parsedEquity) ? 0 : parsedEquity;

    const existing = await prisma.investment.findFirst({
      where: { investor: req.user.id, startup: startupId }
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
          startup: startupId,
          offer: finalOffer,
          equity: finalEquity,
          meetingDate: meetingDate || null,
          status: 'Pending',
          docs: message || 'View folder'
        }
      });
    }

    return res.status(201).json(successResponse('Interest expressed', investment));
  } catch (error) { next(error); }
};

export const makeOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { startupId, offer, amount, equity } = req.body;

    const parsedOffer = parseFloat(offer ?? amount ?? 0);
    const parsedEquity = parseFloat(equity ?? 0);
    const finalOffer = isNaN(parsedOffer) ? 0 : parsedOffer;
    const finalEquity = isNaN(parsedEquity) ? 0 : parsedEquity;

    const existing = await prisma.investment.findFirst({
      where: { investor: req.user.id, startup: startupId }
    });

    let investment;
    if (existing) {
      investment = await prisma.investment.update({
        where: { id: existing.id },
        data: {
          offer: finalOffer,
          equity: finalEquity,
          status: 'Offer'
        }
      });
    } else {
      investment = await prisma.investment.create({
        data: {
          investor: req.user.id,
          startup: startupId,
          offer: finalOffer,
          equity: finalEquity,
          status: 'Offer'
        }
      });
    }

    return res.status(201).json(successResponse('Offer made', investment));
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
    return res.json(successResponse('Investment withdrawn and removed successfully'));
  } catch (error) { next(error); }
};

export const getInvestmentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.investment.findMany({ where: { investor: req.user.id, status: { in: ['Closed', 'Completed', 'Cancelled'] } }, orderBy: { createdAt: 'desc' } });
    return res.json(successResponse('Investment history', history));
  } catch (error) { next(error); }
};
