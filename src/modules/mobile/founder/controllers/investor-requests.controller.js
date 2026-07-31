import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
export const listInvestorRequests = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [requests, total] = await Promise.all([
            prisma.investment.findMany({ where: { startup: req.user.id, status: 'Pending' }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            prisma.investment.count({ where: { startup: req.user.id, status: 'Pending' } })
        ]);
        return res.json(successResponse('Investor requests retrieved', requests, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getInvestorRequest = async (req, res, next) => {
    try {
        const request = await prisma.investment.findFirst({ where: { id: req.params.id, startup: req.user.id } });
        if (!request)
            return res.status(404).json(errorResponse('Request not found', 'NOT_FOUND'));
        return res.json(successResponse('Investor request details', request));
    }
    catch (error) {
        next(error);
    }
};
export const acceptRequest = async (req, res, next) => {
    try {
        await prisma.investment.updateMany({ where: { id: req.params.id, startup: req.user.id }, data: { status: 'Active' } });
        return res.json(successResponse('Request accepted'));
    }
    catch (error) {
        next(error);
    }
};
export const rejectRequest = async (req, res, next) => {
    try {
        await prisma.investment.updateMany({ where: { id: req.params.id, startup: req.user.id }, data: { status: 'Rejected' } });
        return res.json(successResponse('Request rejected'));
    }
    catch (error) {
        next(error);
    }
};
export const scheduleRequestMeeting = async (req, res, next) => {
    try {
        const { date, time } = req.body;
        await prisma.investment.updateMany({ where: { id: req.params.id, startup: req.user.id }, data: { meetingDate: `${date}T${time}Z` } });
        return res.json(successResponse('Meeting scheduled for request'));
    }
    catch (error) {
        next(error);
    }
};
export const messageInvestor = async (req, res, next) => {
    try {
        return res.status(201).json(successResponse('Message sent to investor'));
    }
    catch (error) {
        next(error);
    }
};
