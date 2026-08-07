import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { respondWithUploadedFile } from '../../../../utils/uploaded-file.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

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

    if (assignedTo) {
      await NotificationEngine.queueNotification({
        userId: assignedTo,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `${req.user.fullName || 'The client'} has assigned a new task to you: ${title}`,
        channel: 'all'
      });
    }

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
    const task = await prisma.task.findFirst({ where: { id: req.params.id, project: { client: req.user.id } } });
    if (!task) return res.status(404).json(successResponse('Task not found'));

    await prisma.task.update({ where: { id: task.id }, data: { title, assignedTo, priority, dueDate } });

    if (assignedTo && assignedTo === task.assignedTo) {
      await NotificationEngine.queueNotification({
        userId: assignedTo,
        type: 'task_updated',
        title: 'Task Updated',
        message: `${req.user.fullName || 'The client'} updated your assigned task: ${title || task.title}`,
        channel: 'all'
      });
    } else if (assignedTo && assignedTo !== task.assignedTo) {
      await NotificationEngine.queueNotification({
        userId: assignedTo,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `${req.user.fullName || 'The client'} has assigned a task to you: ${title || task.title}`,
        channel: 'all'
      });
    }

    return res.json(successResponse('Task updated'));
  } catch (error) { next(error); }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const task = await prisma.task.findFirst({ where: { id: req.params.id, project: { client: req.user.id } } });
    if (!task) return res.status(404).json(successResponse('Task not found'));

    await prisma.task.update({ where: { id: task.id }, data: { status } });

    if (task.assignedTo) {
      await NotificationEngine.queueNotification({
        userId: task.assignedTo,
        type: `task_${status.toLowerCase()}`,
        title: 'Task Status Updated',
        message: `${req.user.fullName || 'The client'} updated the status of your task to ${status}.`,
        channel: 'all'
      });
    }

    return res.json(successResponse('Task status updated'));
  } catch (error) { next(error); }
};

export const addTaskComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { comment } = req.body;
    const task = await prisma.task.findFirst({ where: { id: req.params.id, project: { client: req.user.id } } });
    if (!task) return res.status(404).json(successResponse('Task not found'));

    const taskComment = await prisma.taskComment.create({ data: { taskId: task.id, comment, authorId: req.user.id, author: req.user.fullName || 'Client' } });

    if (task.assignedTo) {
      await NotificationEngine.queueNotification({
        userId: task.assignedTo,
        type: 'task_comment',
        title: 'New Comment on Task',
        message: `${req.user.fullName || 'The client'} left a comment on your task.`,
        channel: 'all'
      });
    }

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
