import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const listProposals = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [proposals, total] = await Promise.all([
            prisma.proposal.findMany({ where: { freelancerId: req.user.id }, skip, take: limit }),
            prisma.proposal.count({ where: { freelancerId: req.user.id } })
        ]);
        return res.json(successResponse('Proposals retrieved', proposals, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const createProposal = async (req, res, next) => {
    try {
        const { projectId, bidAmount, coverLetter, deliveryTime } = req.body;
        const proposal = await prisma.proposal.create({
            data: { projectId, freelancerId: req.user.id, bidAmount, coverLetter, status: 'pending' }
        });
        return res.status(201).json(successResponse('Proposal created', proposal));
    }
    catch (error) {
        next(error);
    }
};
export const getProposalDetails = async (req, res, next) => {
    try {
        const proposal = await prisma.proposal.findFirst({ where: { id: req.params.id, freelancerId: req.user.id } });
        return res.json(successResponse('Proposal details retrieved', proposal));
    }
    catch (error) {
        next(error);
    }
};
export const updateProposal = async (req, res, next) => {
    try {
        const { bidAmount, coverLetter } = req.body;
        const proposal = await prisma.proposal.updateMany({
            where: { id: req.params.id, freelancerId: req.user.id },
            data: { bidAmount, coverLetter }
        });
        return res.json(successResponse('Proposal updated', proposal));
    }
    catch (error) {
        next(error);
    }
};
export const withdrawProposal = async (req, res, next) => {
    try {
        await prisma.proposal.updateMany({
            where: { id: req.params.id, freelancerId: req.user.id },
            data: { status: 'withdrawn' }
        });
        return res.json(successResponse('Proposal withdrawn'));
    }
    catch (error) {
        next(error);
    }
};
