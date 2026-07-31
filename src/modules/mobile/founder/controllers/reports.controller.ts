import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getReports = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Reports overview', [])); } catch (error) { next(error); }
};

export const getFundingReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.founderProfile.findUnique({ where: { userId: req.user.id } });
    return res.json(successResponse('Funding report', { goal: 500000, raised: profile?.raised || 0, history: [] }));
  } catch (error) { next(error); }
};

export const getInvestorsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investors = await prisma.investment.findMany({ where: { startup: req.user.id } });
    return res.json(successResponse('Investors report', { totalRequests: investors.length, investors }));
  } catch (error) { next(error); }
};

export const getMeetingsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meetings = await prisma.meeting.findMany({ where: { founder: req.user.id } });
    return res.json(successResponse('Meetings report', { totalMeetings: meetings.length, meetings }));
  } catch (error) { next(error); }
};

export const exportReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Report ready for download', { url: `/mock-exports/report-${req.user.id}.pdf` })); } catch (error) { next(error); }
};
