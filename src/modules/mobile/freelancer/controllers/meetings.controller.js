import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';

const generateMeetingLink = (meetingId) => {
    const short = meetingId.replace(/-/g, '').substring(0, 12);
    const part1 = short.substring(0, 4);
    const part2 = short.substring(4, 8);
    const part3 = short.substring(8, 12);
    return `https://meet.goexperts.in/${part1}-${part2}-${part3}`;
};

// For freelancer: show the other participant as withProfile
const shapeMeeting = (m, userMap, viewerId) => {
    const founderUser  = userMap[m.founder]  || null;
    const investorUser = userMap[m.investor] || null;
    const hostUser     = userMap[m.createdBy] || null;

    // "With" profile: whoever is NOT the current user
    const withProfile = m.founder === viewerId ? investorUser : founderUser;

    // Host = who created the meeting
    const hostProfile = hostUser || withProfile;
    const hostName    = hostProfile ? hostProfile.fullName : 'Unknown';

    const meetingLink = m.meetingLink || generateMeetingLink(m.id);

    return {
        id:          m.id,
        founder:     m.founder,
        investor:    m.investor,
        date:        m.date,
        time:        m.time,
        duration:    m.duration || 45,
        mode:        m.mode,
        status:      m.status,
        meetingLink,
        createdAt:   m.createdAt,
        updatedAt:   m.updatedAt,
        deletedAt:   m.deletedAt,
        withProfile,
        hostName,
        hostProfile,
        participants: [
            ...(hostProfile ? [{ ...hostProfile, role: 'Host' }] : [])
        ]
    };
};

export const listMeetings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const meetings = await prisma.meeting.findMany({
            where: { OR: [{ founder: userId }, { investor: userId }] },
            orderBy: { createdAt: 'desc' }
        });
        const userIds = [...new Set(meetings.flatMap(m => [m.founder, m.investor, m.createdBy].filter(Boolean)))];
        const users = userIds.length > 0 ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, avatarUrl: true, email: true }
        }) : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });
        const shaped = meetings.map(m => shapeMeeting(m, userMap, userId));
        return res.json(successResponse('Meetings retrieved', shaped));
    }
    catch (error) { next(error); }
};

export const getMeetingDetails = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const meeting = await prisma.meeting.findFirst({
            where: { id: req.params.id, OR: [{ founder: userId }, { investor: userId }] }
        });
        if (!meeting) return res.json(successResponse('Meeting details retrieved', null));
        const userIds = [meeting.founder, meeting.investor, meeting.createdBy].filter(Boolean);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, avatarUrl: true, email: true }
        });
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });
        return res.json(successResponse('Meeting details retrieved', shapeMeeting(meeting, userMap, userId)));
    }
    catch (error) { next(error); }
};

export const getUpcomingMeetings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const meetings = await prisma.meeting.findMany({
            where: { OR: [{ founder: userId }, { investor: userId }], status: 'Scheduled' },
            orderBy: { createdAt: 'desc' }
        });
        const userIds = [...new Set(meetings.flatMap(m => [m.founder, m.investor, m.createdBy].filter(Boolean)))];
        const users = userIds.length > 0 ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, avatarUrl: true, email: true }
        }) : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });
        const shaped = meetings.map(m => shapeMeeting(m, userMap, userId));
        return res.json(successResponse('Upcoming meetings retrieved', shaped));
    }
    catch (error) { next(error); }
};

export const scheduleMeeting = async (req, res, next) => {
    try {
        const { date, time, duration, mode, withUserId } = req.body;
        const meeting = await prisma.meeting.create({
            data: {
                founder:   req.user.id,
                investor:  withUserId,
                date,
                time,
                duration:  duration || 45,
                mode:      mode || 'Online',
                status:    'Scheduled',
                createdBy: req.user.id
            }
        });
        const link = generateMeetingLink(meeting.id);
        await prisma.meeting.update({ where: { id: meeting.id }, data: { meetingLink: link } });
        return res.status(201).json(successResponse('Meeting scheduled', { ...meeting, meetingLink: link }));
    }
    catch (error) { next(error); }
};

export const rescheduleMeeting = async (req, res, next) => {
    try {
        const { date, time } = req.body;
        const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, createdBy: req.user.id } });
        if (!meeting) return res.status(403).json({ success: false, message: 'Only the meeting creator can reschedule it.', code: 'FORBIDDEN' });
        await prisma.meeting.update({ where: { id: req.params.id }, data: { date, time } });
        return res.json(successResponse('Meeting rescheduled'));
    }
    catch (error) { next(error); }
};

export const cancelMeeting = async (req, res, next) => {
    try {
        const meeting = await prisma.meeting.findFirst({ where: { id: req.params.id, createdBy: req.user.id } });
        if (!meeting) return res.status(403).json({ success: false, message: 'Only the meeting creator can cancel it.', code: 'FORBIDDEN' });
        await prisma.meeting.update({ where: { id: req.params.id }, data: { status: 'Cancelled' } });
        return res.json(successResponse('Meeting cancelled'));
    }
    catch (error) { next(error); }
};

export const addMeetingNotes = async (req, res, next) => {
    try {
        return res.json(successResponse('Meeting notes added'));
    }
    catch (error) { next(error); }
};
