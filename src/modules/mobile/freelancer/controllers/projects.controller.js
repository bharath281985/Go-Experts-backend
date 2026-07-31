import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
export const listProjects = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [projects, total] = await Promise.all([
            prisma.project.findMany({ where: { freelancer: req.user.id }, skip, take: limit }),
            prisma.project.count({ where: { freelancer: req.user.id } })
        ]);
        return res.json(successResponse('Projects retrieved', projects, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getProjectDetails = async (req, res, next) => {
    try {
        const project = await prisma.project.findFirst({
            where: {
                id: req.params.id,
                OR: [
                    { freelancer: req.user.id },
                    { status: 'open' }
                ]
            },
            include: { milestones: true, tasks: true }
        });
        if (!project) {
            return res.status(404).json(errorResponse('Project not found', 'NOT_FOUND'));
        }
        return res.json(successResponse('Project details retrieved', project));
    }
    catch (error) {
        next(error);
    }
};
export const searchProjects = async (req, res, next) => {
    try {
        const query = req.query.q || '';
        const projects = await prisma.project.findMany({ where: { status: 'open', title: { contains: query } }, take: 20 });
        return res.json(successResponse('Search results', projects));
    }
    catch (error) {
        next(error);
    }
};
export const appliedProjects = async (req, res, next) => res.json(successResponse('Applied projects', []));
export const invitedProjects = async (req, res, next) => res.json(successResponse('Invited projects', []));
export const savedProjects = async (req, res, next) => res.json(successResponse('Saved projects', []));
export const recommendedProjects = async (req, res, next) => res.json(successResponse('Recommended projects', []));
export const nearbyProjects = async (req, res, next) => res.json(successResponse('Nearby projects', []));
