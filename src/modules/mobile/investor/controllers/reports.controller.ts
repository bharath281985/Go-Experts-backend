import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { investor: req.user.id, deletedAt: null }, take: 100 });
    const startupIds = [...new Set(investments.map((investment) => investment.startup).filter(Boolean))];
    return res.json(successResponse('Reports overview', {
      portfolio: {
        totalInvestments: investments.length,
        active: investments.filter((investment) => investment.status === 'Active').length,
        totalCommitted: investments.reduce((sum, investment) => sum + Number(investment.offer || 0), 0),
      },
      startups: {
        uniqueStartups: startupIds.length,
      },
    }));
  } catch (error) {
    next(error);
  }
};

export const getPortfolioReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { investor: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json(successResponse('Portfolio report', { totalInvestments: investments.length, investments }));
  } catch (error) {
    next(error);
  }
};

export const getRoiReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { investor: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
    const byStartup = Object.values(investments.reduce<Record<string, any>>((acc, investment) => {
      const key = investment.startup;
      if (!acc[key]) {
        acc[key] = { startupId: key, invested: 0, deals: 0 };
      }
      acc[key].invested += Number(investment.offer || 0);
      acc[key].deals += 1;
      return acc;
    }, {}));
    return res.json(successResponse('ROI report', { overallROI: null, byStartup }));
  } catch (error) {
    next(error);
  }
};

export const getIndustryReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { investor: req.user.id, deletedAt: null }, take: 100 });
    const startupIds = [...new Set(investments.map((investment) => investment.startup).filter(Boolean))];
    const startups = startupIds.length
      ? await prisma.startupIdea.findMany({ where: { founder: { in: startupIds }, deletedAt: null }, select: { founder: true, industry: true } })
      : [];
    const industrySplit = Object.values(startups.reduce<Record<string, { industry: string; count: number }>>((acc, startup) => {
      const key = startup.industry || 'Unknown';
      if (!acc[key]) acc[key] = { industry: key, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {}));
    return res.json(successResponse('Industry report', { industrySplit }));
  } catch (error) {
    next(error);
  }
};

export const exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { investor: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json(successResponse('Report ready for download', {
      url: null,
      downloadAvailable: false,
      exportedAt: new Date().toISOString(),
      summary: {
        totalInvestments: investments.length,
        totalCommitted: investments.reduce((sum, investment) => sum + Number(investment.offer || 0), 0),
      },
    }));
  } catch (error) {
    next(error);
  }
};