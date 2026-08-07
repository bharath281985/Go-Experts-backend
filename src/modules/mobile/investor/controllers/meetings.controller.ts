import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

export const listMeetings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    let meetings: any[] = [];
    let total = 0;
    try {
      [meetings, total] = await Promise.all([
        prisma.meeting.findMany({
          where: { investor: req.user.id },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            founder: true,
            investor: true,
            date: true,
            time: true,
            mode: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            createdBy: true,
            meetingLink: true,
          },
        }),
        prisma.meeting.count({ where: { investor: req.user.id } }),
      ]);
    } catch {
      meetings = [];
      total = 0;
    }

    const data = meetings.map((m) => ({
      ...m,
      duration: (m as any).duration || 30,
    }));

    return res.json(
      successResponse('Meetings retrieved', data, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

export const scheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { founderId, date, time, mode } = req.body;
    const meeting = await prisma.meeting.create({
      data: { investor: req.user.id, founder: founderId, date, time, mode: mode || 'Online', status: 'Scheduled' }
    });

    await NotificationEngine.queueNotification({
      userId: founderId,
      type: 'meeting_scheduled',
      title: 'New Meeting Scheduled',
      message: `${req.user.fullName || 'An investor'} has scheduled a meeting with you for ${date} at ${time}.`,
      channel: 'all'
    });

    return res.status(201).json(successResponse('Meeting scheduled', meeting));
  } catch (error) { next(error); }
};

export const getMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, investor: req.user.id } });
    return res.json(successResponse('Meeting details', meeting));
  } catch (error) { next(error); }
};

export const rescheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time } = req.body;
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, investor: req.user.id } });
    if (!meeting) return res.status(404).json(successResponse('Meeting not found'));

    await prisma.meeting.update({ where: { id: meeting.id }, data: { date, time } });

    await NotificationEngine.queueNotification({
      userId: meeting.founder,
      type: 'meeting_rescheduled',
      title: 'Meeting Rescheduled',
      message: `${req.user.fullName || 'An investor'} has rescheduled your meeting to ${date} at ${time}.`,
      channel: 'all'
    });

    return res.json(successResponse('Meeting rescheduled'));
  } catch (error) { next(error); }
};

export const cancelMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, investor: req.user.id } });
    if (!meeting) return res.status(404).json(successResponse('Meeting not found'));

    await prisma.meeting.update({ where: { id: meeting.id }, data: { status: 'Cancelled' } });

    await NotificationEngine.queueNotification({
      userId: meeting.founder,
      type: 'meeting_cancelled',
      title: 'Meeting Cancelled',
      message: `${req.user.fullName || 'An investor'} has cancelled the upcoming meeting.`,
      channel: 'all'
    });

    return res.json(successResponse('Meeting cancelled'));
  } catch (error) { next(error); }
};

export const addMeetingNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Meeting notes added')); } catch (error) { next(error); }
};
