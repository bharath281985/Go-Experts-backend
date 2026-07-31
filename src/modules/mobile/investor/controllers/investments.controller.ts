import { Response, NextFunction } from 'express';
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
    if (status) where.status = status;

    const [investments, total] = await Promise.all([
      prisma.investment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.investment.count({ where })
    ]);
    return res.json(successResponse('Investments retrieved', investments, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getInvestment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investment = await prisma.investment.findFirst({ where: { id: req.params.id, investor: req.user.id } });
    return res.json(successResponse('Investment details', investment));
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

    const investment = await prisma.investment.create({
      data: { 
        investor: req.user.id, 
        startup: startupId, 
        offer: finalOffer, 
        equity: finalEquity, 
        meetingDate: meetingDate || null, 
        status: 'Pending',
        docs: message || 'View folder' // Storing optional custom message if provided
      }
    });
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

    const investment = await prisma.investment.create({
      data: { 
        investor: req.user.id, 
        startup: startupId, 
        offer: finalOffer, 
        equity: finalEquity, 
        status: 'Offer' 
      }
    });
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
    await prisma.investment.updateMany({ where: { id: req.params.id, investor: req.user.id, status: 'Pending' }, data: { status: 'Cancelled' } });
    return res.json(successResponse('Investment cancelled'));
  } catch (error) { next(error); }
};

export const getInvestmentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.investment.findMany({ where: { investor: req.user.id, status: { in: ['Closed', 'Completed', 'Cancelled'] } }, orderBy: { createdAt: 'desc' } });
    return res.json(successResponse('Investment history', history));
  } catch (error) { next(error); }
};
