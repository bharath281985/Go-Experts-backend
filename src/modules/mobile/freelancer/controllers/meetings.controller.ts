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
    const userId = req.user.id;
    const meetings = await prisma.meeting.findMany({
      where: { OR: [{ founder: userId }, { investor: userId }] }
    });
    return res.json(successResponse('Meetings retrieved', meetings.map(shapeMeeting)));
  } catch (error) { next(error); }
};

export const scheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time, mode, meeting_link } = req.body;
    const withUserId = String(
      req.body.withUserId ||
      req.body.userId ||
      req.body.clientId ||
      req.body.founderId ||
      req.body.investorId ||
      ''
    ).trim();

    if (!date || !time) {
      return res.status(400).json({ success: false, message: 'date and time are required' });
    }

    if (!withUserId) {
      return res.status(400).json({ success: false, message: 'Meeting participant is required' });
    }

    const meeting = await prisma.meeting.create({
      data: {
        founder: req.user.id,
        investor: withUserId,
        date: String(date),
        time: String(time),
        mode: mode ? String(mode) : 'Online',
        status: 'Scheduled',
        meetingLink: meeting_link ? String(meeting_link).trim() : null,
      },
    });

    await NotificationEngine.queueNotification({
      userId: withUserId,
      type: 'meeting_scheduled',
      title: 'New Meeting Scheduled',
      message: `${req.user.fullName || 'A freelancer'} has scheduled a meeting with you for ${date} at ${time}.`,
      channel: 'all',
    }).catch((error) => {
      console.error('Failed to queue freelancer meeting notification:', error);
    });

    return res.status(201).json(successResponse('Meeting scheduled', shapeMeeting(meeting)));
  } catch (error) { next(error); }
};

export const getMeetingDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, OR: [{ founder: userId }, { investor: userId }] }
    });
    return res.json(successResponse('Meeting details retrieved', shapeMeeting(meeting)));
  } catch (error) { next(error); }
};

export const getUpcomingMeetings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const meetings = await prisma.meeting.findMany({
      where: { OR: [{ founder: userId }, { investor: userId }], status: 'Scheduled' }
    });
    return res.json(successResponse('Upcoming meetings retrieved', meetings.map(shapeMeeting)));
  } catch (error) { next(error); }
};
