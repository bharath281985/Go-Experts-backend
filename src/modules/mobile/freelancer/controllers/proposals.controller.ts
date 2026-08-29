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
    const status = req.query.status as string | undefined;

    const where: any = { freelancerId: req.user.id };
    if (status) where.status = status;

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        include: { project: true }
      }),
      prisma.proposal.count({ where })
    ]);
    return res.json(successResponse('Proposals retrieved', proposals, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const createProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, bidAmount, coverLetter, deliveryTime } = req.body;
    const proposal = await prisma.proposal.create({
      data: { projectId, freelancerId: req.user.id, bidAmount, coverLetter, status: 'pending' }
    });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project && project.client) {
      try {
        await NotificationEngine.queueNotification({
          userId: project.client,
          type: 'new_proposal',
          title: 'New Freelancer Proposal',
          message: `${req.user.fullName || 'A freelancer'} has submitted a proposal for your project!`,
          channel: 'all'
        });
      } catch (notifError) {
        console.error('Failed to queue notification for proposal:', notifError);
      }
    }

    return res.status(201).json(successResponse('Proposal created', proposal));
  } catch (error) { next(error); }
};

export const getProposalDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.findFirst({ 
      where: { id: req.params.id, freelancerId: req.user.id },
      include: { project: true }
    });
    
    if (!proposal) {
      return res.status(404).json(errorResponse('Proposal not found', 'NOT_FOUND'));
    }
    
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
    const proposal = await prisma.proposal.findFirst({
      where: { id: req.params.id, freelancerId: req.user.id }
    });

    if (proposal) {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: 'withdrawn' }
      });

      const project = await prisma.project.findUnique({ where: { id: proposal.projectId } });
      if (project && project.client) {
        try {
          await NotificationEngine.queueNotification({
            userId: project.client,
            type: 'proposal_withdrawn',
            title: 'Proposal Withdrawn',
            message: `${req.user.fullName || 'A freelancer'} has withdrawn their proposal on your project.`,
            channel: 'all'
          });
        } catch (notifError) {
          console.error('Failed to queue notification for proposal withdrawal:', notifError);
        }
      }
    }

    return res.json(successResponse('Proposal withdrawn'));
  } catch (error) { next(error); }
};
