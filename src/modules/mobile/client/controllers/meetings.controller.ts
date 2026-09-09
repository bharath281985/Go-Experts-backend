import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

const roleLabel = (role?: string | null) => {
  if (!role) return 'Participant';
  return role
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const shapeMeeting = async (meeting: any, viewerId?: string) => {
  if (!meeting) return meeting;
  const { meetingLink, ...data } = meeting;
  const participantIds = [meeting.founder, meeting.investor].filter(Boolean);
  const users = participantIds.length
    ? await prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, fullName: true, avatarUrl: true, email: true, role: true },
    }).catch(() => [])
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  const host = meeting.createdBy ? userMap.get(meeting.createdBy) : userMap.get(viewerId || '');
  const withId = meeting.founder === viewerId ? meeting.investor : meeting.founder;
  const withProfile = userMap.get(withId) || null;
  return {
    ...data,
    meeting_link: meetingLink || null,
    withProfile,
    withName: withProfile?.fullName || 'Participant',
    withRole: roleLabel(withProfile?.role),
    withAvatar: withProfile?.avatarUrl || null,
    hostName: host?.fullName || null,
    hostProfile: host || null,
    participants: users.map((user) => ({
      ...user,
      role: user.id === host?.id ? 'Host' : roleLabel(user.role),
    })),
  };
};

export const listMeetings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meetings = await prisma.meeting.findMany({ where: { OR: [{ founder: req.user.id }, { investor: req.user.id }] } });
    const shaped = await Promise.all(meetings.map((meeting) => shapeMeeting(meeting, req.user.id)));
    return res.json(successResponse('Meetings retrieved', shaped));
  } catch (error) { next(error); }
};

export const scheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time, mode, meeting_link } = req.body;
    const withUserId = String(
      req.body.withUserId ||
      req.body.userId ||
      req.body.freelancerId ||
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

    const meeting = await prisma.meeting.create({ data: { founder: req.user.id, investor: withUserId, date, time, mode, status: 'Scheduled', meetingLink: meeting_link ? String(meeting_link).trim() : null } });

    await NotificationEngine.queueNotification({
      userId: withUserId,
      type: 'meeting_scheduled',
      title: 'New Meeting Scheduled',
      message: `${req.user.fullName || 'A client'} has scheduled a meeting with you for ${date} at ${time}.`,
      channel: 'all'
    });

    return res.status(201).json(successResponse('Meeting scheduled', await shapeMeeting(meeting, req.user.id)));
  } catch (error) { next(error); }
};

export const getMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, OR: [{ founder: req.user.id }, { investor: req.user.id }] } });
    return res.json(successResponse('Meeting details', await shapeMeeting(meeting, req.user.id)));
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
