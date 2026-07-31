import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
export const createIdea = async (req, res, next) => {
    try {
        const { startup, industry, category, stage, funding, equity, visibility, pitchDeck, businessPlan, logo, coverUrl } = req.body;
        const parsedFunding = parseFloat(String(funding ?? 0));
        const parsedEquity = parseFloat(String(equity ?? 0));
        const idea = await prisma.startupIdea.create({
            data: {
                founder: req.user.id,
                startup: startup || 'My Startup Idea',
                industry: industry || 'Tech',
                category: category || 'General',
                stage: stage || 'Idea',
                funding: isNaN(parsedFunding) ? 0 : parsedFunding,
                equity: isNaN(parsedEquity) ? 0 : parsedEquity,
                visibility: visibility || 'Public',
                pitchDeck: pitchDeck || null,
                businessPlan: businessPlan || null,
                logo: logo || null,
                coverUrl: coverUrl || null
            }
        });
        return res.status(201).json(successResponse('Startup idea created successfully', idea));
    }
    catch (error) {
        next(error);
    }
};
export const listIdeas = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        let ideas = [];
        let total = 0;
        try {
            [ideas, total] = await Promise.all([
                prisma.startupIdea.findMany({
                    where: { founder: req.user.id, deletedAt: null },
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.startupIdea.count({
                    where: { founder: req.user.id, deletedAt: null }
                })
            ]);
        } catch (dbErr) {
            try {
                const rawIdeas = await prisma.$queryRawUnsafe(
                    `SELECT id, startup, founder, industry, category, stage, funding, equity, visibility, logo, status, views, created_at as createdAt, updated_at as updatedAt FROM startup_ideas WHERE founder = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?`,
                    req.user.id, limit, skip
                );
                ideas = rawIdeas.map(i => ({ ...i, pitchDeck: null, businessPlan: null }));
                const totalRaw = await prisma.$queryRawUnsafe(
                    `SELECT COUNT(*) as cnt FROM startup_ideas WHERE founder = ? AND deleted_at IS NULL`,
                    req.user.id
                );
                total = Number(totalRaw[0]?.cnt || 0);
            } catch {
                ideas = [];
                total = 0;
            }
        }
        const ideaIds = ideas.map(i => i.id);
        const bids = ideaIds.length > 0 ? await prisma.investment.findMany({
            where: {
                OR: [
                    { startup: { in: ideaIds } },
                    { startup: req.user.id }
                ],
                deletedAt: null
            },
            orderBy: { createdAt: 'desc' }
        }) : [];
        const investorIds = [...new Set(bids.map(b => b.investor))];
        const investors = investorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: investorIds } },
                select: { id: true, fullName: true, avatarUrl: true }
            })
            : [];
        const investorMap = {};
        investors.forEach(inv => { investorMap[inv.id] = inv; });
        const bidsWithInvestors = bids.map(b => ({
            ...b,
            investorProfile: investorMap[b.investor] || null
        }));
        const ideasWithBids = ideas.map(idea => {
            const ideaBids = bidsWithInvestors.filter(b => b.startup === idea.id || (b.startup === idea.founder && idea.founder === req.user.id));
            return {
                ...idea,
                founder: req.user.fullName,
                bids: ideaBids,
                bidStatus: getOverallBidStatus(ideaBids)
            };
        });
        const singleIdea = ideasWithBids[0] || null;
        let responseData = null;
        if (singleIdea) {
            const interestedInvestorsList = singleIdea.bids ? singleIdea.bids.map(b => ({
                id: b.id,
                investorId: b.investor,
                investorName: b.investorProfile?.fullName || 'Investor',
                avatarUrl: b.investorProfile?.avatarUrl || null,
                offer: b.offer,
                equity: b.equity,
                status: b.status,
                meetingDate: b.meetingDate || null,
                createdAt: b.createdAt
            })) : [];
            responseData = {
                ...singleIdea,
                interestedInvestors: singleIdea.bids ? singleIdea.bids.length : 0,
                interestedInvestorsList
            };
        }
        return res.json({
            success: true,
            message: responseData ? 'Startup idea retrieved' : 'No startup idea found',
            data: responseData
        });
    }
    catch (error) {
        next(error);
    }
};
export const getIdeaDetails = async (req, res, next) => {
    try {
        const idea = await prisma.startupIdea.findFirst({
            where: { id: req.params.id, founder: req.user.id, deletedAt: null }
        });
        if (!idea) {
            return res.status(404).json(errorResponse('Startup idea not found', 'NOT_FOUND'));
        }
        const bids = await prisma.investment.findMany({
            where: {
                OR: [
                    { startup: idea.id },
                    { startup: idea.founder }
                ],
                deletedAt: null
            },
            orderBy: { createdAt: 'desc' }
        });
        const investorIds = [...new Set(bids.map(b => b.investor))];
        const investors = investorIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: investorIds } },
                select: { id: true, fullName: true, avatarUrl: true }
            })
            : [];
        const investorMap = {};
        investors.forEach(inv => { investorMap[inv.id] = inv; });
        const bidsWithInvestors = bids.map(b => ({
            ...b,
            investorProfile: investorMap[b.investor] || null
        }));
        return res.json(successResponse('Startup idea details', {
            ...idea,
            founder: req.user.fullName,
            bids: bidsWithInvestors,
            bidStatus: getOverallBidStatus(bidsWithInvestors)
        }));
    }
    catch (error) {
        next(error);
    }
};
export const updateIdea = async (req, res, next) => {
    try {
        const { startup, industry, category, stage, funding, equity, visibility, pitchDeck, businessPlan, logo, coverUrl } = req.body;
        const idea = await prisma.startupIdea.findFirst({
            where: { id: req.params.id, founder: req.user.id, deletedAt: null }
        });
        if (!idea) {
            return res.status(404).json(errorResponse('Startup idea not found', 'NOT_FOUND'));
        }
        const parsedFunding = funding !== undefined ? parseFloat(String(funding)) : undefined;
        const parsedEquity = equity !== undefined ? parseFloat(String(equity)) : undefined;
        const updated = await prisma.startupIdea.update({
            where: { id: req.params.id },
            data: {
                startup: startup !== undefined ? startup : undefined,
                industry: industry !== undefined ? industry : undefined,
                category: category !== undefined ? category : undefined,
                stage: stage !== undefined ? stage : undefined,
                funding: parsedFunding !== undefined && !isNaN(parsedFunding) ? parsedFunding : undefined,
                equity: parsedEquity !== undefined && !isNaN(parsedEquity) ? parsedEquity : undefined,
                visibility: visibility !== undefined ? visibility : undefined,
                pitchDeck: pitchDeck !== undefined ? pitchDeck : undefined,
                businessPlan: businessPlan !== undefined ? businessPlan : undefined,
                logo: logo !== undefined ? logo : undefined,
                coverUrl: coverUrl !== undefined ? coverUrl : undefined
            }
        });
        return res.json(successResponse('Startup idea updated successfully', updated));
    }
    catch (error) {
        next(error);
    }
};
export const deleteIdea = async (req, res, next) => {
    try {
        const idea = await prisma.startupIdea.findFirst({
            where: { id: req.params.id, founder: req.user.id, deletedAt: null }
        });
        if (!idea) {
            return res.status(404).json(errorResponse('Startup idea not found', 'NOT_FOUND'));
        }
        await prisma.startupIdea.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        });
        return res.json(successResponse('Startup idea deleted successfully'));
    }
    catch (error) {
        next(error);
    }
};
