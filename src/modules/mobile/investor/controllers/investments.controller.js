import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const listInvestments = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const where = { investor: req.user.id };
        if (status)
            where.status = status;
        const [investments, total] = await Promise.all([
            prisma.investment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            prisma.investment.count({ where })
        ]);

        const startupIds = [...new Set(investments.map(i => i.startup))];
        const startupIdeas = await prisma.startupIdea.findMany({
            where: { id: { in: startupIds } }
        });
        
        const ideaMap = {};
        startupIdeas.forEach(s => ideaMap[s.id] = s);

        // Fetch users to resolve founderId
        const founderNamesOrIds = [...new Set(startupIdeas.map(s => s.founder))];
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { id: { in: founderNamesOrIds } },
                    { fullName: { in: founderNamesOrIds } }
                ]
            },
            select: { id: true, fullName: true }
        });
        const userMap = {};
        users.forEach(u => {
            userMap[u.id] = u.id;
            userMap[u.fullName] = u.id;
        });

        const data = investments.map(inv => {
            const idea = ideaMap[inv.startup];
            if (idea) {
                idea.founderId = userMap[idea.founder] || idea.founder;
            }
            return {
                ...inv,
                ideaDetails: idea || null
            };
        });

        return res.json(successResponse('Investments retrieved', data, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getInvestment = async (req, res, next) => {
    try {
        const investment = await prisma.investment.findFirst({ where: { id: req.params.id, investor: req.user.id } });
        return res.json(successResponse('Investment details', investment));
    }
    catch (error) {
        next(error);
    }
};
export const expressInterest = async (req, res, next) => {
    try {
        const { startupId, offer, amount, equity, message, meetingDate, coverLetter, portfolioUrl } = req.body;
        // Fallback logic to prevent NaN crashes
        const parsedOffer = parseFloat(offer ?? amount ?? 0);
        const parsedEquity = parseFloat(equity ?? 0);
        const finalOffer = isNaN(parsedOffer) ? 0 : parsedOffer;
        const finalEquity = isNaN(parsedEquity) ? 0 : parsedEquity;

        // Serialize coverLetter and portfolioUrl into docs column as JSON
        const docsPayload = JSON.stringify({
            coverLetter: coverLetter || message || '',
            portfolioUrl: portfolioUrl || ''
        });

        const investment = await prisma.investment.create({
            data: {
                investor: req.user.id,
                startup: startupId,
                offer: finalOffer,
                equity: finalEquity,
                meetingDate: meetingDate || null,
                status: 'Pending',
                docs: docsPayload
            }
        });
        return res.status(201).json(successResponse('Interest expressed', investment));
    }
    catch (error) {
        next(error);
    }
};
export const makeOffer = async (req, res, next) => {
    try {
        const { startupId, offer, amount, equity, coverLetter, portfolioUrl } = req.body;
        const parsedOffer = parseFloat(offer ?? amount ?? 0);
        const parsedEquity = parseFloat(equity ?? 0);
        const finalOffer = isNaN(parsedOffer) ? 0 : parsedOffer;
        const finalEquity = isNaN(parsedEquity) ? 0 : parsedEquity;

        // Serialize coverLetter and portfolioUrl into docs column as JSON
        const docsPayload = JSON.stringify({
            coverLetter: coverLetter || '',
            portfolioUrl: portfolioUrl || ''
        });

        const investment = await prisma.investment.create({
            data: {
                investor: req.user.id,
                startup: startupId,
                offer: finalOffer,
                equity: finalEquity,
                status: 'Offer',
                docs: docsPayload
            }
        });
        return res.status(201).json(successResponse('Offer made', investment));
    }
    catch (error) {
        next(error);
    }
};
export const updateInvestmentStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        await prisma.investment.updateMany({ where: { id: req.params.id, investor: req.user.id }, data: { status } });
        return res.json(successResponse('Investment status updated'));
    }
    catch (error) {
        next(error);
    }
};
export const cancelInvestment = async (req, res, next) => {
    try {
        await prisma.investment.updateMany({ where: { id: req.params.id, investor: req.user.id, status: 'Pending' }, data: { status: 'Cancelled' } });
        return res.json(successResponse('Investment cancelled'));
    }
    catch (error) {
        next(error);
    }
};
export const getInvestmentHistory = async (req, res, next) => {
    try {
        const history = await prisma.investment.findMany({ where: { investor: req.user.id, status: { in: ['Closed', 'Completed', 'Cancelled'] } }, orderBy: { createdAt: 'desc' } });
        return res.json(successResponse('Investment history', history));
    }
    catch (error) {
        next(error);
    }
};
