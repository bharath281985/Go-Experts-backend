import { Response, NextFunction } from 'express';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';

const userIdFrom = (req: AuthRequest) => req.user?.id as string | undefined;

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
      department: req.body?.department || req.body?.dept || 'General',
      status: 'invited',
      createdAt: new Date().toISOString(),
    };
    const nextMembers = [member, ...members];
    await setJsonSetting(userId, 'team', nextMembers);
    return res.status(201).json(successResponse('Team member invited', member));
  } catch (error) { next(error); }
};

export const updateTeamMemberRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = userIdFrom(req);
    if (!userId) return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    const members = await getJsonSetting(userId, 'team', [] as any[]);
    const index = members.findIndex((member: any) => member.id === req.params.id);
    if (index < 0) return res.status(404).json(errorResponse('Team member not found', 'NOT_FOUND'));
    members[index] = { ...members[index], role: req.body?.role || members[index].role, updatedAt: new Date().toISOString() };
    await setJsonSetting(userId, 'team', members);
    return res.json(successResponse('Team member role updated', members[index]));
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
    await setJsonSetting(userId, 'team', members.filter((member: any) => member.id !== req.params.id));
    return res.json(successResponse('Team member removed'));
  } catch (error) { next(error); }
};
