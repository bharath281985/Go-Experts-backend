import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

const shapeMeeting = (meeting: any) => {
  if (!meeting) return meeting;
  const { meetingLink, ...data } = meeting;
  return { ...data, meeting_link: meetingLink || null };
};

export const listMeetings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meetings = await prisma.meeting.findMany({ where: { OR: [{ founder: req.user.id }, { investor: req.user.id }] } });
    return res.json(successResponse('Meetings retrieved', meetings.map(shapeMeeting)));
  } catch (error) { next(error); }
};

export const scheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time, mode, withUserId, meeting_link } = req.body;
    const meeting = await prisma.meeting.create({ data: { founder: req.user.id, investor: withUserId, date, time, mode, status: 'Scheduled', meetingLink: meeting_link ? String(meeting_link).trim() : null } });

    await NotificationEngine.queueNotification({
      userId: withUserId,
      type: 'meeting_scheduled',
      title: 'New Meeting Scheduled',
      message: `${req.user.fullName || 'A client'} has scheduled a meeting with you for ${date} at ${time}.`,
      channel: 'all'
    });

    return res.status(201).json(successResponse('Meeting scheduled', shapeMeeting(meeting)));
  } catch (error) { next(error); }
};

export const getMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, OR: [{ founder: req.user.id }, { investor: req.user.id }] } });
    return res.json(successResponse('Meeting details', shapeMeeting(meeting)));
  } catch (error) { next(error); }
};

export const rescheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time } = req.body;
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, founder: req.user.id } });
    if (!meeting) return res.status(404).json(successResponse('Meeting not found'));

    await prisma.meeting.update({ where: { id: meeting.id }, data: { date, time } });

    await NotificationEngine.queueNotification({
      userId: meeting.investor,
      type: 'meeting_rescheduled',
      title: 'Meeting Rescheduled',
      message: `${req.user.fullName || 'The client'} has rescheduled your meeting to ${date} at ${time}.`,
      channel: 'all'
    });

    return res.json(successResponse('Meeting rescheduled'));
  } catch (error) { next(error); }
};

export const cancelMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, founder: req.user.id } });
    if (!meeting) return res.status(404).json(successResponse('Meeting not found'));

    await prisma.meeting.update({ where: { id: meeting.id }, data: { status: 'Cancelled' } });

    await NotificationEngine.queueNotification({
      userId: meeting.investor,
      type: 'meeting_cancelled',
      title: 'Meeting Cancelled',
      message: `${req.user.fullName || 'The client'} has cancelled the upcoming meeting.`,
      channel: 'all'
    });

    return res.json(successResponse('Meeting cancelled'));
  } catch (error) { next(error); }
};

export const addMeetingNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Notes added')); } catch (error) { next(error); }
};
