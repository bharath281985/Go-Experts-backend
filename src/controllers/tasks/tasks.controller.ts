import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { successResponse, errorResponse } from '../../core/response.js';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware.js';

export const listTasks = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, status, assignedTo } = req.query;
    
    const where: any = { deletedAt: null };
    
    if (projectId) where.projectId = String(projectId);
    if (status) where.status = String(status);
    if (assignedTo) where.assignedTo = String(assignedTo);

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.json(successResponse('Tasks retrieved successfully', tasks));
  } catch (error) {
    next(error);
  }
};

export const getTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.findUnique({
      where: { id }
    });

    if (!task || task.deletedAt) {
      return res.status(404).json(errorResponse('Task not found'));
    }

    return res.json(successResponse('Task retrieved successfully', task));
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, title, assignedTo, priority, status, dueDate, progress } = req.body;

    if (!projectId || !title) {
      return res.status(400).json(errorResponse('Project ID and Title are required'));
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        assignedTo: assignedTo || null,
        priority: priority || 'Medium',
        status: status || 'todo',
        dueDate: dueDate || null,
        progress: progress ? Number(progress) : 0,
      }
    });

    return res.status(201).json(successResponse('Task created successfully', task));
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, assignedTo, priority, status, dueDate, progress } = req.body;

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json(errorResponse('Task not found'));
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        assignedTo: assignedTo !== undefined ? assignedTo : existing.assignedTo,
        priority: priority !== undefined ? priority : existing.priority,
        status: status !== undefined ? status : existing.status,
        dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
        progress: progress !== undefined ? Number(progress) : existing.progress,
      }
    });

    return res.json(successResponse('Task updated successfully', task));
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return res.status(404).json(errorResponse('Task not found'));
    }

    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return res.json(successResponse('Task deleted successfully', null));
  } catch (error) {
    next(error);
  }
};
