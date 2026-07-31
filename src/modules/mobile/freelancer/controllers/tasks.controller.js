import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const listTasks = async (req, res, next) => {
    try {
        const status = req.query.status;
        const where = { assignedTo: req.user.id };
        if (status)
            where.status = status;
        const tasks = await prisma.task.findMany({ where });
        return res.json(successResponse('Tasks retrieved', tasks));
    }
    catch (error) {
        next(error);
    }
};
export const getTaskDetails = async (req, res, next) => {
    try {
        const task = await prisma.task.findFirst({
            where: { id: req.params.id, assignedTo: req.user.id },
            include: { checklists: true, comments: true, attachments: true, timeLogs: true }
        });
        return res.json(successResponse('Task details retrieved', task));
    }
    catch (error) {
        next(error);
    }
};
export const updateTaskStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const task = await prisma.task.updateMany({
            where: { id: req.params.id, assignedTo: req.user.id },
            data: { status }
        });
        return res.json(successResponse('Task status updated', task));
    }
    catch (error) {
        next(error);
    }
};
export const startTimer = async (req, res, next) => {
    try {
        return res.json(successResponse('Task timer started'));
    }
    catch (error) {
        next(error);
    }
};
export const stopTimer = async (req, res, next) => {
    try {
        return res.json(successResponse('Task timer stopped'));
    }
    catch (error) {
        next(error);
    }
};
export const manualTimeLog = async (req, res, next) => {
    try {
        const { hours, description } = req.body;
        return res.json(successResponse('Time logged manually'));
    }
    catch (error) {
        next(error);
    }
};
