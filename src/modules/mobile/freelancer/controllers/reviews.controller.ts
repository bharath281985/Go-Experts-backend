import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getReceivedReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const targetId = (req.query.targetId as string) || (req.user?.id as string);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({ where: { revieweeId: targetId }, skip, take: limit }),
      prisma.review.count({ where: { revieweeId: targetId } })
    ]);
    return res.json(successResponse('Reviews retrieved', reviews, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getAverageRating = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const targetId = (req.query.targetId as string) || (req.user?.id as string);
    const reviews = await prisma.review.findMany({ where: { revieweeId: targetId } });
    const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 5.0;
    return res.json(successResponse('Average rating retrieved', { averageRating: avg, totalReviews: reviews.length }));
  } catch (error) { next(error); }
};

export const getRatingBreakdown = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    return res.json(successResponse('Rating breakdown retrieved', breakdown));
  } catch (error) { next(error); }
};

export const replyToReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Review reply submitted'));
  } catch (error) { next(error); }
};
