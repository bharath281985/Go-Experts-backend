import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const where: any = { assignedTo: req.user.id };
    if (status) where.status = status;
    
    const tasks = await prisma.task.findMany({ where });
    return res.json(successResponse('Tasks retrieved', tasks));
  } catch (error) { next(error); }
};

export const getTaskDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.findFirst({ 
      where: { id: req.params.id, assignedTo: req.user.id },
      include: { checklists: true, comments: true, attachments: true, timeLogs: true }
    });
    return res.json(successResponse('Task details retrieved', task));
  } catch (error) { next(error); }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const task = await prisma.task.updateMany({
      where: { id: req.params.id, assignedTo: req.user.id },
      data: { status }
    });
    return res.json(successResponse('Task status updated', task));
  } catch (error) { next(error); }
};

export const startTimer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Task timer started'));
  } catch (error) { next(error); }
};

export const stopTimer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Task timer stopped'));
  } catch (error) { next(error); }
};

export const manualTimeLog = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { hours, description } = req.body;
    return res.json(successResponse('Time logged manually'));
  } catch (error) { next(error); }
};
