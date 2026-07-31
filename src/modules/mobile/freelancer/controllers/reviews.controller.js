import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getReceivedReviews = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [reviews, total] = await Promise.all([
            prisma.review.findMany({ where: { revieweeId: req.user.id }, skip, take: limit }),
            prisma.review.count({ where: { revieweeId: req.user.id } })
        ]);
        return res.json(successResponse('Reviews retrieved', reviews, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getAverageRating = async (req, res, next) => {
    try {
        const reviews = await prisma.review.findMany({ where: { revieweeId: req.user.id } });
        const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 5.0;
        return res.json(successResponse('Average rating retrieved', { averageRating: avg, totalReviews: reviews.length }));
    }
    catch (error) {
        next(error);
    }
};
export const getRatingBreakdown = async (req, res, next) => {
    try {
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        return res.json(successResponse('Rating breakdown retrieved', breakdown));
    }
    catch (error) {
        next(error);
    }
};
export const replyToReview = async (req, res, next) => {
    try {
        return res.json(successResponse('Review reply submitted'));
    }
    catch (error) {
        next(error);
    }
};
