import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listContracts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string;
    const where: any = { clientId: req.user.id };
    if (status) where.status = status;
    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.contract.count({ where })
    ]);
    return res.json(successResponse('Contracts retrieved', contracts, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findFirst({ where: { id: req.params.id, clientId: req.user.id } });
    return res.json(successResponse('Contract details', contract));
  } catch (error) { next(error); }
};

export const createContract = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, freelancerId, proposalId } = req.body;
    const num = `CON-${Date.now()}`;
    const contract = await prisma.contract.create({
      data: { contractNumber: num, projectId, clientId: req.user.id, freelancerId, proposalId, status: 'pending_acceptance' }
    });
    return res.status(201).json(successResponse('Contract created', contract));
  } catch (error) { next(error); }
};

const updateContractStatus = (status: string) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.contract.updateMany({ where: { id: req.params.id, clientId: req.user.id }, data: { status } });
    return res.json(successResponse(`Contract ${status}`));
  } catch (error) { next(error); }
};

export const activateContract = updateContractStatus('active');
export const completeContract = updateContractStatus('completed');
export const cancelContract = updateContractStatus('cancelled');

export const getContractMilestones = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findFirst({ where: { id: req.params.id, clientId: req.user.id } });
    if (!contract) return res.json(successResponse('Milestones', []));
    const milestones = await prisma.milestone.findMany({ where: { projectId: contract.projectId } });
    return res.json(successResponse('Milestones retrieved', milestones));
  } catch (error) { next(error); }
};

export const addContractMilestone = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findFirst({ where: { id: req.params.id, clientId: req.user.id } });
    if (!contract) return res.json(successResponse('Contract not found'));
    const { title, dueDate } = req.body;
    const milestone = await prisma.milestone.create({ data: { projectId: contract.projectId, title, dueDate } });
    return res.status(201).json(successResponse('Milestone added', milestone));
  } catch (error) { next(error); }
};
