import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import { successResponse, errorResponse } from '../../core/response.js';
import { AuthRequest } from '../../middleware/auth.js';

export const getTasks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    
    // Determine user access logic here if needed (e.g. only tasks they are assigned to, or on projects they own)
    // For now, if projectId is provided, fetch tasks for it
    const whereClause: any = { deletedAt: null };
    if (projectId) {
      whereClause.projectId = String(projectId);
    } else {
      // If no project ID is provided, return tasks assigned to the current user
      if (req.user?.id) {
        whereClause.assignedTo = req.user.id;
      }
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            title: true,
          }
        },
        checklists: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(successResponse('Tasks retrieved successfully', tasks));
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, title: true }
        },
        checklists: true,
        comments: {
          orderBy: { createdAt: 'desc' }
        },
        attachments: true
      }
    });

    if (!task || task.deletedAt) {
      return res.status(404).json(errorResponse('Task not found'));
    }

    return res.json(successResponse('Task retrieved successfully', task));
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, title, priority, status, dueDate, assignedTo, progress } = req.body;

    if (!projectId || !title) {
      return res.status(400).json(errorResponse('Project ID and Title are required'));
    }

    const newTask = await prisma.task.create({
      data: {
        projectId,
        title,
        priority: priority || 'Medium',
        status: status || 'todo',
        dueDate: dueDate ? String(dueDate) : null,
        assignedTo: assignedTo || null,
        progress: progress ? parseInt(progress, 10) : 0,
      }
    });

    return res.status(201).json(successResponse('Task created successfully', newTask));
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, priority, status, dueDate, assignedTo, progress } = req.body;

    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask || existingTask.deletedAt) {
      return res.status(404).json(errorResponse('Task not found'));
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(priority !== undefined && { priority }),
        ...(status !== undefined && { status }),
        ...(dueDate !== undefined && { dueDate: dueDate ? String(dueDate) : null }),
        ...(assignedTo !== undefined && { assignedTo }),
        ...(progress !== undefined && { progress: parseInt(progress, 10) }),
      }
    });

    return res.json(successResponse('Task updated successfully', updatedTask));
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const existingTask = await prisma.task.findUnique({ where: { id } });
    if (!existingTask || existingTask.deletedAt) {
      return res.status(404).json(errorResponse('Task not found'));
    }

    // Soft delete
    await prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return res.json(successResponse('Task deleted successfully'));
  } catch (error) {
    next(error);
  }
};
