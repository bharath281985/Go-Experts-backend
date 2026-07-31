import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listContracts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({ where: { freelancerId: req.user.id }, skip, take: limit }),
      prisma.contract.count({ where: { freelancerId: req.user.id } })
    ]);
    return res.json(successResponse('Contracts retrieved', contracts, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getContractDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findFirst({ where: { id: req.params.id, freelancerId: req.user.id } });
    return res.json(successResponse('Contract details retrieved', contract));
  } catch (error) { next(error); }
};

export const acceptContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.updateMany({
      where: { id: req.params.id, freelancerId: req.user.id, status: 'pending_acceptance' },
      data: { status: 'active' }
    });
    return res.json(successResponse('Contract accepted', contract));
  } catch (error) { next(error); }
};

export const rejectContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.updateMany({
      where: { id: req.params.id, freelancerId: req.user.id, status: 'pending_acceptance' },
      data: { status: 'cancelled' }
    });
    return res.json(successResponse('Contract rejected', contract));
  } catch (error) { next(error); }
};

export const getContractMilestones = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Contract milestones', []));
export const getContractTimeline = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Contract timeline', []));
export const getContractDocuments = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Contract documents', []));
