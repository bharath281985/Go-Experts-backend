import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

const monthTotal = (rows: { amount: number; createdAt: Date }[]) => {
  const now = new Date();
  return rows
    .filter((row) => row.createdAt.getMonth() === now.getMonth() && row.createdAt.getFullYear() === now.getFullYear())
    .reduce((sum, row) => sum + row.amount, 0);
};

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [totalProjects, activeContracts, allPayments] = await Promise.all([
      prisma.project.count({ where: { freelancer: userId } }),
      prisma.contract.count({ where: { freelancerId: userId, status: 'active' } }),
      prisma.payment.findMany({ where: { userId, status: 'completed' } }),
    ]);

    const totalEarnings = allPayments.reduce((acc, payment) => acc + payment.amount, 0);
    const monthlyEarnings = monthTotal(allPayments);

    return res.json(successResponse('Analytics retrieved', { totalProjects, activeContracts, totalEarnings, monthlyEarnings }));
  } catch (error) {
    next(error);
  }
};

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [payments, projects, contracts] = await Promise.all([
      prisma.payment.findMany({ where: { userId: req.user.id, status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.project.findMany({ where: { freelancer: req.user.id }, select: { id: true, status: true, budget: true }, take: 50 }),
      prisma.contract.findMany({ where: { freelancerId: req.user.id }, select: { clientId: true, status: true }, take: 50 }),
    ]);

    return res.json(successResponse('Reports retrieved', {
      earnings: {
        total: payments.reduce((sum, payment) => sum + payment.amount, 0),
        thisMonth: monthTotal(payments),
        transactions: payments.length,
      },
      projects: {
        total: projects.length,
        inProgress: projects.filter((project) => project.status === 'in_progress').length,
        completed: projects.filter((project) => project.status === 'completed').length,
        cancelled: projects.filter((project) => project.status === 'cancelled').length,
      },
      clients: {
        totalContracts: contracts.length,
        totalClients: new Set(contracts.map((contract) => contract.clientId).filter(Boolean)).size,
      },
    }));
  } catch (error) {
    next(error);
  }
};

export const getEarningsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    const total = payments.reduce((acc, payment) => acc + payment.amount, 0);
    return res.json(successResponse('Earnings report', { total, payments }));
  } catch (error) {
    next(error);
  }
};

export const getProjectsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [inProgress, completed, cancelled] = await Promise.all([
      prisma.project.count({ where: { freelancer: userId, status: 'in_progress' } }),
      prisma.project.count({ where: { freelancer: userId, status: 'completed' } }),
      prisma.project.count({ where: { freelancer: userId, status: 'cancelled' } }),
    ]);
    return res.json(successResponse('Projects report', { inProgress, completed, cancelled }));
  } catch (error) {
    next(error);
  }
};

export const getClientsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contracts = await prisma.contract.findMany({ where: { freelancerId: req.user.id }, select: { clientId: true, status: true }, take: 50 });
    return res.json(successResponse('Clients report', { totalClients: contracts.length, contracts }));
  } catch (error) {
    next(error);
  }
};

export const exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id, status: 'completed' }, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json(successResponse('Export ready', {
      url: null,
      downloadAvailable: false,
      exportedAt: new Date().toISOString(),
      summary: {
        totalEarnings: payments.reduce((sum, payment) => sum + payment.amount, 0),
        transactionCount: payments.length,
      },
    }));
  } catch (error) {
    next(error);
  }
};