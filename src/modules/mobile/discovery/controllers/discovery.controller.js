import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { RecommendationEngine } from '../../../../services/mobile/recommendation.service.js';
export const addRecentlyViewed = async (req, res, next) => {
    try {
        const { entityType, entityId } = req.body;
        if (!entityType || !entityId) {
            return res.status(400).json(errorResponse('entityType and entityId are required', 'VALIDATION_ERROR'));
        }
        return res.status(201).json(successResponse('Recently viewed tracked', { entityType, entityId }));
    }
    catch (error) {
        next(error);
    }
};
export const listRecentlyViewed = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        return res.json(successResponse('Recently viewed', [], { page, limit, total: 0, totalPages: 0 }));
    }
    catch (error) {
        next(error);
    }
};
export const clearRecentlyViewed = async (req, res, next) => {
    try {
        return res.json(successResponse('Recently viewed cleared'));
    }
    catch (error) {
        next(error);
    }
};
export const deleteRecentlyViewedItem = async (req, res, next) => {
    try {
        return res.json(successResponse('Recently viewed item removed'));
    }
    catch (error) {
        next(error);
    }
};
export const getRecommendations = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        let recommendations = {};
        switch (req.user.role) {
            case 'freelancer':
                recommendations = await RecommendationEngine.forFreelancer({ userId: req.user.id, role: 'freelancer', limit });
                break;
            case 'client':
                recommendations = await RecommendationEngine.forClient({ userId: req.user.id, role: 'client', limit });
                break;
            case 'investor':
                recommendations = await RecommendationEngine.forInvestor({ userId: req.user.id, role: 'investor', limit });
                break;
            case 'founder':
                recommendations = await RecommendationEngine.forFounder({ userId: req.user.id, role: 'founder', limit });
                break;
        }
        return res.json(successResponse('Recommendations retrieved', recommendations));
    }
    catch (error) {
        next(error);
    }
};
export const getTrending = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const [trendingFreelancers, trendingStartups, trendingSkills] = await Promise.all([
            prisma.user.findMany({ where: { role: 'freelancer', status: 'active', isVerified: true }, take: limit }),
            prisma.user.findMany({ where: { role: 'founder', status: 'active', isVerified: true }, take: limit }),
            prisma.skill.findMany({ where: { status: 'active' }, take: limit })
        ]);
        return res.json(successResponse('Trending items', {
            freelancers: trendingFreelancers,
            startups: trendingStartups,
            keywords: trendingSkills.map((skill) => skill.name)
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getPopular = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const [popularFreelancers, popularStartups, popularSkills] = await Promise.all([
            prisma.user.findMany({ where: { role: 'freelancer', status: 'active' }, take: limit }),
            prisma.user.findMany({ where: { role: 'founder', status: 'active' }, take: limit }),
            prisma.skill.findMany({ where: { status: 'active' }, take: limit })
        ]);
        return res.json(successResponse('Popular items', {
            freelancers: popularFreelancers,
            startups: popularStartups,
            keywords: popularSkills.map((skill) => skill.name)
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getDiscoveryFeed = async (req, res, next) => {
    try {
        const limit = 5;
        let recommendations = {};
        if (req.user) {
            switch (req.user.role) {
                case 'freelancer':
                    recommendations = await RecommendationEngine.forFreelancer({ userId: req.user.id, role: 'freelancer', limit });
                    break;
                case 'client':
                    recommendations = await RecommendationEngine.forClient({ userId: req.user.id, role: 'client', limit });
                    break;
                case 'investor':
                    recommendations = await RecommendationEngine.forInvestor({ userId: req.user.id, role: 'investor', limit });
                    break;
                case 'founder':
                    recommendations = await RecommendationEngine.forFounder({ userId: req.user.id, role: 'founder', limit });
                    break;
            }
        }
        const trending = await prisma.user.findMany({ where: { status: 'active', isVerified: true }, take: limit });
        const popular = await prisma.skill.findMany({ where: { status: 'active' }, take: limit });
        return res.json(successResponse('Discovery feed', {
            recommendations,
            trending,
            popular: popular.map((skill) => skill.name)
        }));
    }
    catch (error) {
        next(error);
    }
};
