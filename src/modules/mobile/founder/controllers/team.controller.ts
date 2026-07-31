import { Response, NextFunction } from 'express';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getTeam = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Team members retrieved', [])); } catch (error) { next(error); }
};

export const inviteTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.status(201).json(successResponse('Team member invited', req.body)); } catch (error) { next(error); }
};

export const updateTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Team member updated', { id: req.params.id, ...req.body })); } catch (error) { next(error); }
};

export const removeTeamMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Team member removed')); } catch (error) { next(error); }
};
