import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const listProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({ where: { project: { client: req.user.id } }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.proposal.count({ where: { project: { client: req.user.id } } })
    ]);
    return res.json(successResponse('Proposals retrieved', proposals, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const listProjectProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where: { projectId: req.params.projectId, project: { client: req.user.id } },
        include: { freelancer: { select: { id: true, fullName: true, avatarUrl: true, freelancerProfile: true } } },
        skip, take: limit
      }),
      prisma.proposal.count({ where: { projectId: req.params.projectId, project: { client: req.user.id } } })
    ]);
    const shaped = proposals.map((p) => ({
      ...p,
      freelancerId: p.freelancerId || p.freelancer?.id,
    }));
    return res.json(successResponse('Project proposals', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const getProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: { id: req.params.id, project: { client: req.user.id } },
      include: { freelancer: { select: { id: true, fullName: true, avatarUrl: true, freelancerProfile: true } } }
    });
    if (!proposal) return res.status(404).json(errorResponse('Proposal not found', 'NOT_FOUND'));
    return res.json(
      successResponse('Proposal details', {
        ...proposal,
        freelancerId: proposal.freelancerId || proposal.freelancer?.id,
      })
    );
  } catch (error) { next(error); }
};

const updateProposalStatus = (status: string) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.proposal.updateMany({ where: { id: req.params.id, project: { client: req.user.id } }, data: { status } });
    return res.json(successResponse(`Proposal ${status}`));
  } catch (error) { next(error); }
};

export const shortlistProposal = updateProposalStatus('shortlisted');
export const rejectProposal = updateProposalStatus('rejected');
export const interviewProposal = updateProposalStatus('interview');
export const acceptProposal = updateProposalStatus('accepted');

export const messageFreelancer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { return res.json(successResponse('Message sent to freelancer')); } catch (error) { next(error); }
};
