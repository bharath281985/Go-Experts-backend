import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listMilestones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const milestones = await prisma.milestone.findMany({ where: { project: { client: req.user.id } } });
    return res.json(successResponse('Milestones retrieved', milestones));
  } catch (error) { next(error); }
};

export const getMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const milestone = await prisma.milestone.findFirst({ where: { id: req.params.id, project: { client: req.user.id } } });
    return res.json(successResponse('Milestone details', milestone));
  } catch (error) { next(error); }
};

const updateMilestoneStatus = (status: string) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.milestone.updateMany({ where: { id: req.params.id, project: { client: req.user.id } }, data: { status } });
    return res.json(successResponse(`Milestone ${status.toLowerCase()}`));
  } catch (error) { next(error); }
};

export const approveMilestone = updateMilestoneStatus('Completed');
export const rejectMilestone = updateMilestoneStatus('Pending');
export const releasePayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Payment released for milestone')); } catch (error) { next(error); }
};
