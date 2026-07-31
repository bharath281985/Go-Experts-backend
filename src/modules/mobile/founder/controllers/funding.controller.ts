import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getFunding = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.founderProfile.findUnique({ where: { userId: req.user.id } });
    const rounds = [
      { id: '1', name: 'Pre-seed', goal: 100000, raised: 100000, status: 'Closed' },
      { id: '2', name: 'Seed', goal: 500000, raised: profile?.raised || 0, status: 'Active' }
    ];
    return res.json(successResponse('Funding rounds retrieved', { currentGoal: 500000, totalRaised: profile?.raised || 0, rounds }));
  } catch (error) { next(error); }
};

export const createFundingRound = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, goal, equity } = req.body;
    return res.status(201).json(successResponse('Funding round created', { id: 'new_round_id', name, goal, equity, status: 'Active' }));
  } catch (error) { next(error); }
};

export const updateFundingRound = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Funding round updated', req.body));
  } catch (error) { next(error); }
};

export const getFundingHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({ where: { startup: req.user.id, status: { in: ['Completed', 'Closed'] } } });
    return res.json(successResponse('Funding history', investments));
  } catch (error) { next(error); }
};

export const updateFundingStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    return res.json(successResponse('Funding round status updated', { id: req.params.id, status }));
  } catch (error) { next(error); }
};
