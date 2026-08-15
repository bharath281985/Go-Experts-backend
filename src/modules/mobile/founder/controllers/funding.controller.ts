import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

const fundingStatusesCounted = ['Active', 'Completed', 'Closed', 'Offer'];

const toRound = (investment: any, defaultGoal: number) => ({
  id: investment.id,
  name: investment.status || 'Funding round',
  goal: defaultGoal,
  raised: Number(investment.offer || 0),
  equity: Number(investment.equity || 0),
  status: investment.status,
  meetingDate: investment.meetingDate,
  createdAt: investment.createdAt,
  updatedAt: investment.updatedAt,
});

export const getFunding = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [profile, investments] = await Promise.all([
      prisma.founderProfile.findUnique({ where: { userId: req.user.id } }),
      prisma.investment.findMany({
        where: { startup: req.user.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const currentGoal = Number(profile?.targetRaise || 0);
    const totalRaised = investments
      .filter((investment) => fundingStatusesCounted.includes(investment.status))
      .reduce((sum, investment) => sum + Number(investment.offer || 0), 0);

    return res.json(successResponse('Funding rounds retrieved', {
      currentGoal,
      totalRaised,
      rounds: investments.map((investment) => toRound(investment, currentGoal)),
    }));
  } catch (error) {
    next(error);
  }
};

export const createFundingRound = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, goal, equity } = req.body;
    const numericGoal = goal != null && goal !== '' ? Number(goal) : null;

    const profile = await prisma.founderProfile.upsert({
      where: { userId: req.user.id },
      update: {
        targetRaise: numericGoal,
        ...(name ? { primaryGoal: String(name) } : {}),
      },
      create: {
        userId: req.user.id,
        targetRaise: numericGoal,
        primaryGoal: name ? String(name) : null,
      },
    });

    return res.status(201).json(successResponse('Funding round created', {
      id: profile.id,
      name: name || profile.primaryGoal || 'Funding round',
      goal: profile.targetRaise || 0,
      equity: equity != null && equity !== '' ? Number(equity) : null,
      status: 'Active',
    }));
  } catch (error) {
    next(error);
  }
};

export const updateFundingRound = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, goal, equity } = req.body;
    const profile = await prisma.founderProfile.upsert({
      where: { userId: req.user.id },
      update: {
        ...(goal !== undefined ? { targetRaise: goal != null && goal !== '' ? Number(goal) : null } : {}),
        ...(name !== undefined ? { primaryGoal: name ? String(name) : null } : {}),
      },
      create: {
        userId: req.user.id,
        targetRaise: goal != null && goal !== '' ? Number(goal) : null,
        primaryGoal: name ? String(name) : null,
      },
    });

    return res.json(successResponse('Funding round updated', {
      id: profile.id,
      name: profile.primaryGoal || name || 'Funding round',
      goal: profile.targetRaise || 0,
      equity: equity != null && equity !== '' ? Number(equity) : null,
      status: 'Active',
    }));
  } catch (error) {
    next(error);
  }
};

export const getFundingHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const investments = await prisma.investment.findMany({
      where: { startup: req.user.id, status: { in: ['Completed', 'Closed'] }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(successResponse('Funding history', investments));
  } catch (error) {
    next(error);
  }
};

export const updateFundingStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const result = await prisma.investment.updateMany({
      where: { id: req.params.id, startup: req.user.id, deletedAt: null },
      data: { status: String(status || '') },
    });

    if (!result.count) {
      return res.status(404).json(errorResponse('Funding round not found', 'NOT_FOUND'));
    }

    return res.json(successResponse('Funding round status updated', { id: req.params.id, status }));
  } catch (error) {
    next(error);
  }
};
