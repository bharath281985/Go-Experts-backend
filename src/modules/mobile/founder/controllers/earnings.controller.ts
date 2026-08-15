import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

const currentMonth = (date: Date) => {
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

const currentYear = (date: Date) => {
  const now = new Date();
  return date.getFullYear() === now.getFullYear();
};

export const getMonthlyEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null } });
    const currentMonthTotal = investments.filter((investment) => currentMonth(investment.createdAt)).reduce((sum, investment) => sum + Number(investment.offer || 0), 0);
    const total = investments.reduce((sum, investment) => sum + Number(investment.offer || 0), 0);
    return res.json(successResponse('Monthly earnings retrieved', { total, currentMonth: currentMonthTotal }));
  } catch (error) {
    next(error);
  }
};

export const getYearlyEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null } });
    const currentYearTotal = investments.filter((investment) => currentYear(investment.createdAt)).reduce((sum, investment) => sum + Number(investment.offer || 0), 0);
    const total = investments.reduce((sum, investment) => sum + Number(investment.offer || 0), 0);
    return res.json(successResponse('Yearly earnings retrieved', { total, currentYear: currentYearTotal }));
  } catch (error) {
    next(error);
  }
};

export const getCategoryEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null } });
    const grouped = Object.values(investments.reduce<Record<string, { status: string; total: number; count: number }>>((acc, investment) => {
      const key = investment.status || 'Unknown';
      if (!acc[key]) acc[key] = { status: key, total: 0, count: 0 };
      acc[key].total += Number(investment.offer || 0);
      acc[key].count += 1;
      return acc;
    }, {}));
    return res.json(successResponse('Category earnings retrieved', grouped));
  } catch (error) {
    next(error);
  }
};

export const getClientEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null }, take: 100 });
    const investorIds = [...new Set(investments.map((investment) => investment.investor).filter(Boolean))];
    const users = investorIds.length
      ? await prisma.user.findMany({ where: { id: { in: investorIds } }, select: { id: true, fullName: true, email: true } })
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    const grouped = Object.values(investments.reduce<Record<string, any>>((acc, investment) => {
      const key = investment.investor;
      if (!acc[key]) {
        const investor = userMap.get(key);
        acc[key] = {
          investorId: key,
          investorName: investor?.fullName || null,
          email: investor?.email || null,
          totalOffer: 0,
          deals: 0,
        };
      }
      acc[key].totalOffer += Number(investment.offer || 0);
      acc[key].deals += 1;
      return acc;
    }, {}));

    return res.json(successResponse('Client earnings retrieved', grouped));
  } catch (error) {
    next(error);
  }
};

export const downloadStatement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json(successResponse('Statement ready for download', {
      url: null,
      downloadAvailable: false,
      generatedAt: new Date().toISOString(),
      summary: {
        total: investments.reduce((sum, investment) => sum + Number(investment.offer || 0), 0),
        transactions: investments.length,
      },
    }));
  } catch (error) {
    next(error);
  }
};