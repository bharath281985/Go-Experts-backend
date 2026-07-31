import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile } from '../../../../utils/uploaded-file.js';

export const listTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const where: any = { project: { client: req.user.id } };
    if (status) where.status = status;
    const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json(successResponse('Tasks retrieved', tasks));
  } catch (error) { next(error); }
};

export const createTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, title, assignedTo, priority, dueDate } = req.body;
    const task = await prisma.task.create({ data: { projectId, title, assignedTo, priority, dueDate, status: 'todo' } });
    return res.status(201).json(successResponse('Task created', task));
  } catch (error) { next(error); }
};

export const getTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, project: { client: req.user.id } },
      include: { checklists: true, comments: true, attachments: true, timeLogs: true }
    });
    return res.json(successResponse('Task details', task));
  } catch (error) { next(error); }
};

export const updateTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, assignedTo, priority, dueDate } = req.body;
    await prisma.task.updateMany({ where: { id: req.params.id, project: { client: req.user.id } }, data: { title, assignedTo, priority, dueDate } });
    return res.json(successResponse('Task updated'));
  } catch (error) { next(error); }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    await prisma.task.updateMany({ where: { id: req.params.id, project: { client: req.user.id } }, data: { status } });
    return res.json(successResponse('Task status updated'));
  } catch (error) { next(error); }
};

export const addTaskComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { comment } = req.body;
    const taskComment = await prisma.taskComment.create({ data: { taskId: req.params.id, comment, authorId: req.user.id, author: req.user.fullName || 'Client' } });
    return res.status(201).json(successResponse('Comment added', taskComment));
  } catch (error) { next(error); }
};

export const addTaskAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return respondWithUploadedFile(req, res, 'Attachment uploaded'); } catch (error) { next(error); }
};

export const getTaskTimeLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.timeLog.findMany({ where: { taskId: req.params.id } });
    return res.json(successResponse('Time logs retrieved', logs));
  } catch (error) { next(error); }
};
