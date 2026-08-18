import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

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
