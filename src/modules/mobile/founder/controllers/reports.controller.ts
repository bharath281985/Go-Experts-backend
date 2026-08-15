import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [profile, investments, meetings] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } }),
      prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null }, take: 100 }),
      prisma.meeting.findMany({ where: { founder: req.user.id, deletedAt: null }, take: 100 }),
    ]);

    return res.json(successResponse('Reports overview', {
      funding: {
        goal: Number(profile?.targetRaise || 0),
        raised: investments.reduce((sum, investment) => sum + Number(investment.offer || 0), 0),
        totalRequests: investments.length,
      },
      investors: {
        active: investments.filter((investment) => investment.status === 'Active').length,
        pending: investments.filter((investment) => investment.status === 'Pending').length,
      },
      meetings: {
        total: meetings.length,
        scheduled: meetings.filter((meeting) => meeting.status === 'Scheduled').length,
        cancelled: meetings.filter((meeting) => meeting.status === 'Cancelled').length,
      },
    }));
  } catch (error) {
    next(error);
  }
};

export const getFundingReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [profile, history] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } }),
      prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return res.json(successResponse('Funding report', {
      goal: Number(profile?.targetRaise || 0),
      raised: history.reduce((sum, investment) => sum + Number(investment.offer || 0), 0),
      history,
    }));
  } catch (error) {
    next(error);
  }
};

export const getInvestorsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investors = await prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json(successResponse('Investors report', { totalRequests: investors.length, investors }));
  } catch (error) {
    next(error);
  }
};

export const getMeetingsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meetings = await prisma.meeting.findMany({ where: { founder: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json(successResponse('Meetings report', { totalMeetings: meetings.length, meetings }));
  } catch (error) {
    next(error);
  }
};

export const exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { startup: req.user.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json(successResponse('Report ready for download', {
      url: null,
      downloadAvailable: false,
      exportedAt: new Date().toISOString(),
      summary: {
        totalRequests: investments.length,
        totalRaised: investments.reduce((sum, investment) => sum + Number(investment.offer || 0), 0),
      },
    }));
  } catch (error) {
    next(error);
  }
};