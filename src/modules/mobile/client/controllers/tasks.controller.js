import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { respondWithUploadedFile } from '../../../../utils/uploaded-file.js';
export const listTasks = async (req, res, next) => {
    try {
        const status = req.query.status;
        const where = { project: { client: req.user.id } };
        if (status)
            where.status = status;
        const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
        return res.json(successResponse('Tasks retrieved', tasks));
    }
    catch (error) {
        next(error);
    }
};
export const createTask = async (req, res, next) => {
    try {
        const { projectId, title, assignedTo, priority, dueDate } = req.body;
        const task = await prisma.task.create({ data: { projectId, title, assignedTo, priority, dueDate, status: 'todo' } });
        return res.status(201).json(successResponse('Task created', task));
    }
    catch (error) {
        next(error);
    }
};
export const getTask = async (req, res, next) => {
    try {
        const task = await prisma.task.findFirst({
            where: { id: req.params.id, project: { client: req.user.id } },
            include: { checklists: true, comments: true, attachments: true, timeLogs: true }
        });
        return res.json(successResponse('Task details', task));
    }
    catch (error) {
        next(error);
    }
};
export const updateTask = async (req, res, next) => {
    try {
        const { title, assignedTo, priority, dueDate } = req.body;
        await prisma.task.updateMany({ where: { id: req.params.id, project: { client: req.user.id } }, data: { title, assignedTo, priority, dueDate } });
        return res.json(successResponse('Task updated'));
    }
    catch (error) {
        next(error);
    }
};
export const updateTaskStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        await prisma.task.updateMany({ where: { id: req.params.id, project: { client: req.user.id } }, data: { status } });
        return res.json(successResponse('Task status updated'));
    }
    catch (error) {
        next(error);
    }
};
export const addTaskComment = async (req, res, next) => {
    try {
        const { comment } = req.body;
        const taskComment = await prisma.taskComment.create({ data: { taskId: req.params.id, comment, authorId: req.user.id, author: req.user.fullName || 'Client' } });
        return res.status(201).json(successResponse('Comment added', taskComment));
    }
    catch (error) {
        next(error);
    }
};
export const addTaskAttachment = async (req, res, next) => {
    try {
        return respondWithUploadedFile(req, res, 'Attachment uploaded');
    }
    catch (error) {
        next(error);
    }
};
export const getTaskTimeLogs = async (req, res, next) => {
    try {
        const logs = await prisma.timeLog.findMany({ where: { taskId: req.params.id } });
        return res.json(successResponse('Time logs retrieved', logs));
    }
    catch (error) {
        next(error);
    }
};
