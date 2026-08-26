import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({ where: { freelancerId: req.user.id }, skip, take: limit }),
      prisma.proposal.count({ where: { freelancerId: req.user.id } })
    ]);
    return res.json(successResponse('Proposals retrieved', proposals, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const createProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, bidAmount, coverLetter } = req.body;
    const proposal = await prisma.proposal.create({
      data: { projectId, freelancerId: req.user.id, bidAmount, coverLetter, status: 'pending' }
    });
    return res.status(201).json(successResponse('Proposal created', proposal));
  } catch (error) { next(error); }
};

export const getProposalDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.findFirst({ where: { id: req.params.id, freelancerId: req.user.id } });
    return res.json(successResponse('Proposal details retrieved', proposal));
  } catch (error) { next(error); }
};

export const updateProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bidAmount, coverLetter } = req.body;
    const proposal = await prisma.proposal.updateMany({
      where: { id: req.params.id, freelancerId: req.user.id },
      data: { bidAmount, coverLetter }
    });
    return res.json(successResponse('Proposal updated', proposal));
  } catch (error) { next(error); }
};

export const withdrawProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.proposal.updateMany({
      where: { id: req.params.id, freelancerId: req.user.id },
      data: { status: 'withdrawn' }
    });
    return res.json(successResponse('Proposal withdrawn'));
  } catch (error) { next(error); }
};
