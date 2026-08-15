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
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id, status: 'completed' } });
    const currentMonthTotal = payments.filter((payment) => currentMonth(payment.createdAt)).reduce((sum, payment) => sum + payment.amount, 0);
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return res.json(successResponse('Monthly earnings retrieved', { total, currentMonth: currentMonthTotal }));
  } catch (error) {
    next(error);
  }
};

export const getYearlyEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id, status: 'completed' } });
    const currentYearTotal = payments.filter((payment) => currentYear(payment.createdAt)).reduce((sum, payment) => sum + payment.amount, 0);
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    return res.json(successResponse('Yearly earnings retrieved', { total, currentYear: currentYearTotal }));
  } catch (error) {
    next(error);
  }
};

export const getCategoryEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id, status: 'completed' } });
    const grouped = Object.values(payments.reduce<Record<string, { gateway: string; total: number; count: number }>>((acc, payment) => {
      const key = payment.gateway || 'unknown';
      if (!acc[key]) acc[key] = { gateway: key, total: 0, count: 0 };
      acc[key].total += payment.amount;
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
    const contracts = await prisma.contract.findMany({
      where: { freelancerId: req.user.id },
      include: { client: { select: { id: true, fullName: true, email: true } }, project: { select: { budget: true } } },
      take: 100,
    });

    const grouped = Object.values(contracts.reduce<Record<string, any>>((acc, contract) => {
      const key = contract.clientId;
      if (!acc[key]) {
        acc[key] = {
          clientId: contract.clientId,
          clientName: contract.client?.fullName || null,
          email: contract.client?.email || null,
          totalBudget: 0,
          contracts: 0,
        };
      }
      acc[key].totalBudget += Number(contract.project?.budget || 0);
      acc[key].contracts += 1;
      return acc;
    }, {}));

    return res.json(successResponse('Client earnings retrieved', grouped));
  } catch (error) {
    next(error);
  }
};

export const downloadStatement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id, status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json(successResponse('Statement ready for download', {
      url: null,
      downloadAvailable: false,
      generatedAt: new Date().toISOString(),
      summary: {
        total: payments.reduce((sum, payment) => sum + payment.amount, 0),
        transactions: payments.length,
      },
    }));
  } catch (error) {
    next(error);
  }
};