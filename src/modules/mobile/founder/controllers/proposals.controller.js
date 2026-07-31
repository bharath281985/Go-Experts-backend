import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';

const unpackDocs = (docsValue) => {
    try {
        const parsed = JSON.parse(docsValue);
        if (parsed && typeof parsed === 'object') {
            return {
                coverLetter: parsed.coverLetter || '',
                portfolioUrl: parsed.portfolioUrl || '',
                docs: docsValue
            };
        }
    } catch (e) {
        // Fallback
    }
    return {
        coverLetter: docsValue || '',
        portfolioUrl: '',
        docs: docsValue
    };
};

export const listProposals = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;

        // Get startup ideas owned by this founder
        const myStartups = await prisma.startupIdea.findMany({
            where: { founder: req.user.id },
            select: { id: true }
        });
        const startupIds = myStartups.map(s => s.id);

        const whereClause = {
            OR: [
                { startup: { in: startupIds } },
                { startup: req.user.id }
            ],
            deletedAt: null
        };

        const [investments, total] = await Promise.all([
            prisma.investment.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.investment.count({ where: whereClause })
        ]);

        const investorIds = [...new Set(investments.map(i => i.investor))];
        const users = investorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: investorIds } },
                select: { id: true, fullName: true, avatarUrl: true }
            })
            : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });

        const ideaIds = [...new Set(investments.map(i => i.startup).filter(id => !id.startsWith('fd-') && !id.startsWith('usr-')))];
        const ideas = ideaIds.length > 0
            ? await prisma.startupIdea.findMany({
                where: { id: { in: ideaIds } },
                select: { id: true, startup: true, stage: true }
            })
            : [];
        const ideaMap = {};
        ideas.forEach(i => { ideaMap[i.id] = i; });

        const shaped = investments.map(inv => {
            const startupDetail = ideaMap[inv.startup] || null;
            const unpacked = unpackDocs(inv.docs);
            return {
                id: inv.id,
                investor: inv.investor,
                startup: inv.startup,
                offer: inv.offer,
                equity: inv.equity,
                meetingDate: inv.meetingDate,
                ...unpacked,
                status: inv.status,
                createdAt: inv.createdAt,
                updatedAt: inv.updatedAt,
                deletedAt: inv.deletedAt,
                investorProfile: userMap[inv.investor] || null,
                startupDetails: startupDetail
            };
        });

        return res.json(successResponse('Bids retrieved', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};

export const listProjectProposals = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;

        const idea = await prisma.startupIdea.findFirst({
            where: { id: req.params.projectId, founder: req.user.id, deletedAt: null }
        });
        if (!idea) {
            return res.status(404).json(errorResponse('Startup idea not found', 'NOT_FOUND'));
        }

        const [investments, total] = await Promise.all([
            prisma.investment.findMany({
                where: { startup: req.params.projectId, deletedAt: null },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.investment.count({
                where: { startup: req.params.projectId, deletedAt: null }
            })
        ]);

        const investorIds = [...new Set(investments.map(i => i.investor))];
        const users = investorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: investorIds } },
                select: { id: true, fullName: true, avatarUrl: true }
            })
            : [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });

        const shaped = investments.map(inv => {
            const unpacked = unpackDocs(inv.docs);
            return {
                ...inv,
                ...unpacked,
                investorProfile: userMap[inv.investor] || null
            };
        });

        return res.json(successResponse('Project bids retrieved', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};

export const getProposal = async (req, res, next) => {
    try {
        const investment = await prisma.investment.findUnique({
            where: { id: req.params.id }
        });
        if (!investment || investment.deletedAt) {
            return res.status(404).json(errorResponse('Bid not found', 'NOT_FOUND'));
        }

        const idea = await prisma.startupIdea.findFirst({
            where: {
                OR: [
                    { id: investment.startup, founder: req.user.id },
                    { founder: req.user.id, id: investment.startup }
                ]
            }
        });
        if (!idea && investment.startup !== req.user.id) {
            return res.status(403).json(errorResponse('Unauthorized to view this bid', 'UNAUTHORIZED'));
        }

        const investor = await prisma.user.findUnique({
            where: { id: investment.investor },
            select: { id: true, fullName: true, avatarUrl: true }
        });

        const unpacked = unpackDocs(investment.docs);
        const shaped = {
            ...investment,
            ...unpacked,
            investorProfile: investor || null
        };
        return res.json(successResponse('Bid details retrieved', shaped));
    }
    catch (error) {
        next(error);
    }
};

const updateProposalStatus = (status, message) => async (req, res, next) => {
    try {
        const investment = await prisma.investment.findUnique({
            where: { id: req.params.id }
        });
        if (!investment || investment.deletedAt) {
            return res.status(404).json(errorResponse('Bid not found', 'NOT_FOUND'));
        }

        const idea = await prisma.startupIdea.findFirst({
            where: {
                OR: [
                    { id: investment.startup, founder: req.user.id },
                    { founder: req.user.id }
                ]
            }
        });
        if (!idea && investment.startup !== req.user.id) {
            return res.status(403).json(errorResponse('Unauthorized to update this bid', 'UNAUTHORIZED'));
        }

        const updated = await prisma.investment.update({
            where: { id: req.params.id },
            data: { status }
        });

        const investor = await prisma.user.findUnique({
            where: { id: updated.investor },
            select: { id: true, fullName: true, avatarUrl: true }
        });

        return res.json(successResponse(message, {
            ...updated,
            investorProfile: investor || null
        }));
    }
    catch (error) {
        next(error);
    }
};

export const acceptProposal = updateProposalStatus('Accepted', 'Bid accepted');
export const rejectProposal = updateProposalStatus('Rejected', 'Bid rejected');
