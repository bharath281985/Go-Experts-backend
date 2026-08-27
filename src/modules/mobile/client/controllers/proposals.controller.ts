import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

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
    const proposalIds = proposals.map(p => p.id);
    const contracts = await prisma.contract.findMany({
      where: { proposalId: { in: proposalIds } },
      select: { id: true, proposalId: true }
    });
    const contractMap = new Map();
    contracts.forEach(c => {
      if (c.proposalId) {
        contractMap.set(c.proposalId, c.id);
      }
    });

    const shaped = proposals.map((p) => ({
      ...p,
      freelancerId: p.freelancerId || p.freelancer?.id,
      contractId: contractMap.get(p.id) || null,
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

    const contract = await prisma.contract.findFirst({
      where: { proposalId: proposal.id },
      select: { id: true }
    });

    return res.json(
      successResponse('Proposal details', {
        ...proposal,
        freelancerId: proposal.freelancerId || proposal.freelancer?.id,
        contractId: contract?.id || null,
      })
    );
  } catch (error) { next(error); }
};

const updateProposalStatus = (status: string) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.findFirst({ where: { id: req.params.id, project: { client: req.user.id } } });
    if (!proposal) return res.status(404).json(successResponse('Proposal not found'));

    await prisma.proposal.update({ where: { id: proposal.id }, data: { status } });

    await NotificationEngine.queueNotification({
      userId: proposal.freelancerId,
      type: `proposal_${status}`,
      title: `Proposal ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `${req.user.fullName || 'The client'} has ${status} your proposal.`,
      channel: 'all'
    });

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
