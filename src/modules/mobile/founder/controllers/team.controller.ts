import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';

const userIdFrom = (req: AuthRequest) => req.user?.id as string | undefined;

const syncTeamSize = (userId: string, memberCount: number) => prisma.founderProfile.upsert({
  where: { userId },
  update: { teamSize: memberCount + 1 },
  create: { userId, teamSize: memberCount + 1 },
});

export const getTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = userIdFrom(req);
    if (!userId) return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    const members = await getJsonSetting(userId, 'team', [] as any[]);
    return res.json(successResponse('Team members retrieved', members, { total: members.length }));
  } catch (error) { next(error); }
};

export const inviteTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = userIdFrom(req);
    if (!userId) return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!name || !email) return res.status(400).json(errorResponse('name and email are required', 'VALIDATION_ERROR'));

    const members = await getJsonSetting(userId, 'team', [] as any[]);
    if (members.some((member: any) => String(member.email).toLowerCase() === email)) {
      return res.status(409).json(errorResponse('Team member already invited', 'TEAM_MEMBER_EXISTS'));
    }
    const member = {
      id: `TM-${Date.now().toString(36).toUpperCase()}`,
      name,
      email,
      role: req.body?.role || 'Member',
      status: 'invited',
      createdAt: new Date().toISOString(),
    };
    const nextMembers = [member, ...members];
    await setJsonSetting(userId, 'team', nextMembers);
    await syncTeamSize(userId, nextMembers.length);
    return res.status(201).json(successResponse('Team member invited', member));
  } catch (error) { next(error); }
};

export const updateTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = userIdFrom(req);
    if (!userId) return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    const members = await getJsonSetting(userId, 'team', [] as any[]);
    const index = members.findIndex((member: any) => member.id === req.params.id);
    if (index < 0) return res.status(404).json(errorResponse('Team member not found', 'NOT_FOUND'));
    const { id: _id, createdAt: _createdAt, ...updates } = req.body || {};
    members[index] = { ...members[index], ...updates, updatedAt: new Date().toISOString() };
    await setJsonSetting(userId, 'team', members);
    return res.json(successResponse('Team member updated', members[index]));
  } catch (error) { next(error); }
};

export const removeTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = userIdFrom(req);
    if (!userId) return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    const members = await getJsonSetting(userId, 'team', [] as any[]);
    if (!members.some((member: any) => member.id === req.params.id)) {
      return res.status(404).json(errorResponse('Team member not found', 'NOT_FOUND'));
    }
    const nextMembers = members.filter((member: any) => member.id !== req.params.id);
    await setJsonSetting(userId, 'team', nextMembers);
    await syncTeamSize(userId, nextMembers.length);
    return res.json(successResponse('Team member removed'));
  } catch (error) { next(error); }
};
