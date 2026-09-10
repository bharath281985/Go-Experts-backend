import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

const proposalAttachments = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [value];
  } catch {
    return [value];
  }
};

const shapeProposal = async (proposal: any) => {
  if (!proposal) return proposal;
  const project = proposal.project || await prisma.project.findUnique({
    where: { id: proposal.projectId },
  }).catch(() => null);
  const freelancer = proposal.freelancer || (proposal.freelancerId
    ? await prisma.user.findUnique({
      where: { id: proposal.freelancerId },
      select: { id: true, fullName: true, avatarUrl: true, freelancerProfile: true },
    }).catch(() => null)
    : null);
  const client = project?.client
    ? await prisma.user.findUnique({
      where: { id: project.client },
      select: { id: true, fullName: true, avatarUrl: true },
    }).catch(() => null)
    : null;
  return {
    ...proposal,
    attachments: proposalAttachments(proposal.attachments),
    project,
    projectTitle: project?.title || proposal.projectTitle || 'Project',
    projectDescription: project?.description || proposal.projectDescription || '',
    clientId: client?.id || project?.client || proposal.clientId || null,
    clientName: client?.fullName || proposal.clientName || 'Client',
    clientAvatar: client?.avatarUrl || null,
    freelancerId: proposal.freelancerId,
    freelancer,
    freelancerName: freelancer?.fullName || proposal.freelancerName || 'Freelancer',
    freelancerAvatar: freelancer?.avatarUrl || null,
    freelancerRating: freelancer?.freelancerProfile?.rating || proposal.freelancerRating || 4.8,
  };
};

export const listProposals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const search = String(req.query.search || req.query.q || '').trim();

    const where: any = { freelancerId: req.user.id, deletedAt: null };
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { project: { title: { contains: search } } },
        { project: { description: { contains: search } } },
        { coverLetter: { contains: search } },
        { project: { category: { contains: search } } },
        { project: { technology: { contains: search } } },
        { freelancerName: { contains: search } },
      ];
    }

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        include: {
          project: true,
          freelancer: { select: { id: true, fullName: true, avatarUrl: true, freelancerProfile: true } },
        }
      }),
      prisma.proposal.count({ where })
    ]);
    const shaped = await Promise.all(proposals.map(shapeProposal));
    return res.json(successResponse('Proposals retrieved', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};

export const createProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { projectId, bidAmount, coverLetter, deliveryTime, attachments } = req.body;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
    }
    if (project.client === req.user.id) {
      return res.status(400).json(errorResponse('You cannot submit a proposal to your own project.', 'INVALID_OPERATION'));
    }

    const existingProposal = await prisma.proposal.findFirst({
      where: {
        projectId,
        freelancerId: req.user.id,
        deletedAt: null,
        status: { not: 'withdrawn' },
      },
    });
    if (existingProposal) {
      return res.json(successResponse('Proposal already submitted', await shapeProposal(existingProposal)));
    }

    const proposal = await prisma.proposal.create({
      data: {
        projectId,
        freelancerId: req.user.id,
        bidAmount,
        coverLetter,
        deliveryTime,
        attachments: JSON.stringify(
          Array.isArray(attachments) ? attachments.filter(Boolean).map(String) : [],
        ),
        status: 'pending',
      }
    });

    if (project.client) {
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

    return res.status(201).json(successResponse('Proposal created', await shapeProposal(proposal)));
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
    
    return res.json(successResponse('Proposal details retrieved', await shapeProposal(proposal)));
  } catch (error) { next(error); }
};

export const updateProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bidAmount, coverLetter, deliveryTime, attachments } = req.body;
    const existing = await prisma.proposal.findFirst({
      where: { id: req.params.id, freelancerId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json(errorResponse('Proposal not found', 'NOT_FOUND'));
    }

    const proposal = await prisma.proposal.update({
      where: { id: existing.id },
      data: {
        bidAmount,
        coverLetter,
        ...(deliveryTime !== undefined ? ({ deliveryTime } as any) : {}),
        ...(Array.isArray(attachments)
          ? { attachments: JSON.stringify(attachments.filter(Boolean).map(String)) }
          : {}),
      },
      include: {
        project: true,
        freelancer: { select: { id: true, fullName: true, avatarUrl: true, freelancerProfile: true } },
      },
    });
    return res.json(successResponse('Proposal updated', await shapeProposal(proposal)));
  } catch (error) { next(error); }
};

export const withdrawProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: {
        freelancerId: req.user.id,
        deletedAt: null,
        status: { not: 'withdrawn' },
        OR: [
          { id: req.params.id },
          { projectId: req.params.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!proposal) {
      return res.status(404).json(errorResponse('Proposal not found', 'PROPOSAL_NOT_FOUND'));
    }

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

    return res.json(successResponse('Proposal withdrawn'));
  } catch (error) { next(error); }
};

export const deleteProposal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposal = await prisma.proposal.findFirst({
      where: { id: req.params.id, freelancerId: req.user.id },
      select: { id: true },
    });

    if (!proposal) {
      return res.status(404).json(errorResponse('Proposal not found', 'PROPOSAL_NOT_FOUND'));
    }

    await prisma.proposal.delete({ where: { id: proposal.id } });
    return res.json(successResponse('Proposal deleted permanently', { deleted: true }));
  } catch (error) {
    next(error);
  }
};
