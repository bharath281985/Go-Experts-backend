import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

const generateMeetingLink = (meetingId: string) => {
  const short = meetingId.replace(/-/g, '').substring(0, 12);
  const part1 = short.substring(0, 4);
  const part2 = short.substring(4, 8);
  const part3 = short.substring(8, 12);
  return `https://meet.goexperts.in/${part1}-${part2}-${part3}`;
};

const shapeUser = (user: any, role: string) => {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role,
  };
};

const shapeMeeting = (meeting: any, userMap: Record<string, any>, viewerRole: string) => {
  const founderUser = shapeUser(userMap[meeting.founder], 'founder');
  const investorUser = shapeUser(userMap[meeting.investor], 'investor');
  const hostUser = shapeUser(userMap[meeting.createdBy], userMap[meeting.createdBy]?.role || viewerRole) || (viewerRole === 'founder' ? founderUser : investorUser);
  const withProfile = viewerRole === 'founder' ? investorUser : founderUser;
  const participants = [founderUser, investorUser].filter(Boolean).map((participant) => ({
    ...participant,
    role: participant?.id === hostUser?.id ? 'Host' : 'Participant',
  }));

  return {
    id: meeting.id,
    founder: meeting.founder,
    investor: meeting.investor,
    date: meeting.date,
    time: meeting.time,
    duration: meeting.duration || 45,
    mode: meeting.mode || 'Online',
    status: meeting.status || 'Scheduled',
    meetingLink: meeting.meetingLink || generateMeetingLink(meeting.id),
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    withProfile,
    hostName: hostUser?.fullName || null,
    hostProfile: hostUser,
    participants,
  };
};

const getUserMap = async (ids: string[]) => {
  if (!ids.length) return {} as Record<string, any>;

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, fullName: true, avatarUrl: true, email: true, role: true },
  });

  return users.reduce<Record<string, any>>((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {});
};

export const listMeetings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where: { founder: req.user.id, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.meeting.count({ where: { founder: req.user.id, deletedAt: null } }),
    ]);

    const userIds = [...new Set(meetings.flatMap((meeting) => [meeting.founder, meeting.investor, meeting.createdBy].filter(Boolean) as string[]))];
    const userMap = await getUserMap(userIds);
    const shaped = meetings.map((meeting) => shapeMeeting(meeting, userMap, 'founder'));

    return res.json(successResponse('Meetings retrieved', shaped, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    }));
  } catch (error) {
    next(error);
  }
};

export const scheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { investorId, date, time, mode, duration } = req.body;
    const investor = await prisma.user.findFirst({ where: { id: investorId, role: 'investor', deletedAt: null } });

    if (!investor) {
      return res.status(404).json(errorResponse('Investor not found', 'NOT_FOUND'));
    }

    const meeting = await prisma.meeting.create({
      data: {
        founder: req.user.id,
        investor: investorId,
        date,
        time,
        duration: duration ? Number(duration) : 45,
        mode: mode || 'Google Meet',
        status: 'Scheduled',
        createdBy: req.user.id,
      },
    });

    const meetingWithLink = await prisma.meeting.update({
      where: { id: meeting.id },
      data: { meetingLink: generateMeetingLink(meeting.id) },
    });

    await NotificationEngine.queueNotification({
      userId: investorId,
      type: 'meeting_scheduled',
      title: 'New Meeting Scheduled',
      message: `${req.user.fullName || 'A founder'} has scheduled a meeting with you for ${date} at ${time}.`,
      channel: 'all',
    });

    const userMap = await getUserMap([req.user.id, investorId]);
    return res.status(201).json(successResponse('Meeting scheduled', shapeMeeting(meetingWithLink, userMap, 'founder')));
  } catch (error) {
    next(error);
  }
};

export const getMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: { id: req.params.id, founder: req.user.id, deletedAt: null },
    });

    if (!meeting) {
      return res.status(404).json(errorResponse('Meeting not found', 'NOT_FOUND'));
    }

    const userMap = await getUserMap([meeting.founder, meeting.investor, meeting.createdBy].filter(Boolean) as string[]);
    return res.json(successResponse('Meeting details', shapeMeeting(meeting, userMap, 'founder')));
  } catch (error) {
    next(error);
  }
};

export const rescheduleMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, time, duration } = req.body;
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, founder: req.user.id, deletedAt: null } });

    if (!meeting) {
      return res.status(404).json(errorResponse('Meeting not found', 'NOT_FOUND'));
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        ...(date !== undefined ? { date } : {}),
        ...(time !== undefined ? { time } : {}),
        ...(duration !== undefined ? { duration: Number(duration) } : {}),
      },
    });

    await NotificationEngine.queueNotification({
      userId: meeting.investor,
      type: 'meeting_rescheduled',
      title: 'Meeting Rescheduled',
      message: `${req.user.fullName || 'The founder'} has rescheduled your meeting to ${updated.date} at ${updated.time}.`,
      channel: 'all',
    });

    const userMap = await getUserMap([updated.founder, updated.investor, updated.createdBy].filter(Boolean) as string[]);
    return res.json(successResponse('Meeting rescheduled', shapeMeeting(updated, userMap, 'founder')));
  } catch (error) {
    next(error);
  }
};

export const cancelMeeting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, founder: req.user.id, deletedAt: null } });

    if (!meeting) {
      return res.status(404).json(errorResponse('Meeting not found', 'NOT_FOUND'));
    }

    const updated = await prisma.meeting.update({ where: { id: meeting.id }, data: { status: 'Cancelled' } });

    await NotificationEngine.queueNotification({
      userId: meeting.investor,
      type: 'meeting_cancelled',
      title: 'Meeting Cancelled',
      message: `${req.user.fullName || 'The founder'} has cancelled the upcoming meeting.`,
      channel: 'all',
    });

    const userMap = await getUserMap([updated.founder, updated.investor, updated.createdBy].filter(Boolean) as string[]);
    return res.json(successResponse('Meeting cancelled', shapeMeeting(updated, userMap, 'founder')));
  } catch (error) {
    next(error);
  }
};

export const addMeetingNotes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, founder: req.user.id, deletedAt: null } });
    if (!meeting) {
      return res.status(404).json(errorResponse('Meeting not found', 'NOT_FOUND'));
    }

    return res.status(501).json(errorResponse('Meeting notes storage is not configured yet', 'NOT_IMPLEMENTED'));
  } catch (error) {
    next(error);
  }
};
