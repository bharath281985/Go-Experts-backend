import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listMeetings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meetings = await prisma.meeting.findMany({ where: { OR: [{ founder: req.user.id }, { investor: req.user.id }] } });
    return res.json(successResponse('Meetings retrieved', meetings));
  } catch (error) { next(error); }
};

export const scheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time, mode, withUserId } = req.body;
    const meeting = await prisma.meeting.create({ data: { founder: req.user.id, investor: withUserId, date, time, mode, status: 'Scheduled' } });
    return res.status(201).json(successResponse('Meeting scheduled', meeting));
  } catch (error) { next(error); }
};

export const getMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, OR: [{ founder: req.user.id }, { investor: req.user.id }] } });
    return res.json(successResponse('Meeting details', meeting));
  } catch (error) { next(error); }
};

export const rescheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time } = req.body;
    await prisma.meeting.updateMany({ where: { id: req.params.id, founder: req.user.id }, data: { date, time } });
    return res.json(successResponse('Meeting rescheduled'));
  } catch (error) { next(error); }
};

export const cancelMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.meeting.updateMany({ where: { id: req.params.id, founder: req.user.id }, data: { status: 'Cancelled' } });
    return res.json(successResponse('Meeting cancelled'));
  } catch (error) { next(error); }
};

export const addMeetingNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Notes added')); } catch (error) { next(error); }
};
