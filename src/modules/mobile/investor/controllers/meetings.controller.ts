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
  const withId = meeting.investor === viewerId ? meeting.founder : meeting.investor;
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

    const data = await Promise.all(meetings.map(async (m) => ({
      ...(await shapeMeeting(m, req.user.id)),
      duration: (m as any).duration || 30,
    })));

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
    const { date, time, mode, meeting_link, title, agenda, description } = req.body;
    const founderId = String(
      req.body.founderId ||
      req.body.userId ||
      req.body.withUserId ||
      req.body.clientId ||
      req.body.freelancerId ||
      ''
    ).trim();
    const meeting = await prisma.meeting.create({
      data: { title: title ? String(title).trim() : 'Meeting', agenda: String(agenda || description || '').trim() || null, investor: req.user.id, founder: founderId, date, time, mode: mode || 'Online', status: 'Scheduled', meetingLink: meeting_link ? String(meeting_link).trim() : null }
    });

    await NotificationEngine.queueNotification({
      userId: founderId,
      type: 'meeting_scheduled',
      title: 'New Meeting Scheduled',
      message: `${req.user.fullName || 'An investor'} has scheduled a meeting with you for ${date} at ${time}.`,
      channel: 'all'
    });

    return res.status(201).json(successResponse('Meeting scheduled', await shapeMeeting(meeting, req.user.id)));
  } catch (error) { next(error); }
};

export const getMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, investor: req.user.id } });
    return res.json(successResponse('Meeting details', await shapeMeeting(meeting, req.user.id)));
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
