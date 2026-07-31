import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [totalProjects, activeContracts, totalPayments] = await Promise.all([
      prisma.project.count({ where: { client: userId } }),
      prisma.contract.count({ where: { clientId: userId, status: 'active' } }),
      prisma.payment.count({ where: { userId } })
    ]);
    return res.json(successResponse('Analytics retrieved', { totalProjects, activeContracts, totalPayments, monthlySpend: 0 }));
  } catch (error) { next(error); }
};

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Reports retrieved', [])); } catch (error) { next(error); }
};

export const getSpendReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    const total = payments.reduce((acc, p) => acc + p.amount, 0);
    return res.json(successResponse('Spend report', { total, payments }));
  } catch (error) { next(error); }
};

export const getProjectsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const [open, inProgress, completed, cancelled] = await Promise.all([
      prisma.project.count({ where: { client: userId, status: 'open' } }),
      prisma.project.count({ where: { client: userId, status: 'in_progress' } }),
      prisma.project.count({ where: { client: userId, status: 'completed' } }),
      prisma.project.count({ where: { client: userId, status: 'cancelled' } })
    ]);
    return res.json(successResponse('Projects report', { open, inProgress, completed, cancelled }));
  } catch (error) { next(error); }
};

export const getFreelancersReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contracts = await prisma.contract.findMany({ where: { clientId: req.user.id }, select: { freelancerId: true, status: true }, take: 50 });
    return res.json(successResponse('Freelancers report', { totalHired: contracts.length, contracts }));
  } catch (error) { next(error); }
};

export const exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Export ready', { url: `/mock-exports/report-${req.user.id}.csv` })); } catch (error) { next(error); }
};
