import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listContracts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;

    const where: any = { freelancerId: req.user.id };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { contractNumber: { contains: search } },
      ];
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.contract.count({ where })
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
