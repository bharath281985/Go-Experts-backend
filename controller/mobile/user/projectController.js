const mongoose = require('mongoose');
const Project = require('../../../models/Project');
const ProjectInterest = require('../../../models/ProjectInterest');
const Invitation = require('../../../models/Invitation');

const ACTIVE_PROJECT_STATUSES = ['pending', 'live'];
const INACTIVE_PROJECT_STATUSES = ['closed', 'paused', 'rejected', 'flagged'];

const getRequestFilters = (req) => ({
    ...req.query,
    ...(req.body || {})
});

const getPagination = (filters) => {
    const page = Math.max(parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

const getStatusFilter = (status) => {
    if (!status) return null;

    const normalizedStatus = status.toString().trim().toLowerCase().replace(/[\s-]+/g, '');

    if (normalizedStatus === 'active') {
        return { $in: ACTIVE_PROJECT_STATUSES };
    }

    if (normalizedStatus === 'inactive') {
        return { $in: INACTIVE_PROJECT_STATUSES };
    }

    if (normalizedStatus === 'completed') {
        return 'completed';
    }

    return null;
};

const getPrimaryProjectRole = (user) => {
    if (Array.isArray(user.roles) && user.roles.length) {
        return user.roles.find((role) => ['client', 'freelancer'].includes(role));
    }

    return ['client', 'freelancer'].includes(user.role) ? user.role : null;
};

const buildSearchFilter = (search) => {
    if (!search || !search.trim()) return {};

    const regex = { $regex: search.trim(), $options: 'i' };
    return {
        $or: [
            { title: regex },
            { description: regex },
            { category: regex },
            { skills_required: regex }
        ]
    };
};

const getProjectStats = async (projectId) => {
    const [proposals, interviewing, invites] = await Promise.all([
        ProjectInterest.countDocuments({ project_id: projectId }),
        ProjectInterest.countDocuments({ project_id: projectId, status: 'interviewing' }),
        Invitation.countDocuments({ project_id: projectId })
    ]);

    return {
        proposals,
        interviewing,
        invites
    };
};

/**
 * @desc    Get logged-in user's projects with search, status and pagination
 * @route   POST /api/mobile/user/my-projects
 * @route   GET /api/mobile/user/my-projects
 * @access  Private
 */
exports.getMyProjects = async (req, res) => {
    try {
        const userId = req.user.id;
        const filters = getRequestFilters(req);
        const { search, status } = filters;
        const role = getPrimaryProjectRole(req.user);
        const { page, limit, skip } = getPagination(filters);
        const statusFilter = getStatusFilter(status);

        if (!role) {
            return res.status(400).json({
                success: false,
                message: 'Your account does not have client or freelancer access.'
            });
        }

        if (status && !statusFilter) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Use active, inactive or completed.'
            });
        }

        if (role === 'client') {
            const query = {
                client_id: userId,
                ...buildSearchFilter(search)
            };

            if (statusFilter) {
                query.status = statusFilter;
            }

            const [projects, total] = await Promise.all([
                Project.find(query)
                    .populate('hired_freelancer_id', 'full_name profile_image location')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                Project.countDocuments(query)
            ]);

            const data = await Promise.all(projects.map(async (project) => {
                const stats = await getProjectStats(project._id);
                return {
                    ...project.toObject(),
                    proposals: stats.proposals,
                    stats
                };
            }));

            return res.status(200).json({
                success: true,
                message: 'My projects fetched successfully.',
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        }

        const projectQuery = buildSearchFilter(search);
        if (statusFilter) {
            projectQuery.status = statusFilter;
        }

        const matchingProjectIds = await Project.find(projectQuery).distinct('_id');
        const interestQuery = {
            freelancer_id: userId,
            project_id: { $in: matchingProjectIds }
        };

        const [interests, total] = await Promise.all([
            ProjectInterest.find(interestQuery)
                .populate({
                    path: 'project_id',
                    populate: [
                        { path: 'client_id', select: 'full_name profile_image location created_at kyc_details kyc_status' },
                        { path: 'hired_freelancer_id', select: 'full_name profile_image location' }
                    ]
                })
                .sort({ created_at: -1 })
                .skip(skip)
                .limit(limit),
            ProjectInterest.countDocuments(interestQuery)
        ]);

        const data = interests
            .filter((interest) => interest.project_id)
            .map((interest) => ({
                ...interest.project_id.toObject(),
                proposal_status: interest.status,
                my_bid: interest.bid_amount,
                delivery_time: interest.delivery_time,
                portfolio_link: interest.portfolio_link,
                bid_created_at: interest.created_at
            }));

        return res.status(200).json({
            success: true,
            message: 'My projects fetched successfully.',
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get one logged-in user's project detail
 * @route   GET /api/mobile/user/my-projects/:id
 * @access  Private
 */
exports.getMyProjectById = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid project id.' });
        }

        const project = await Project.findById(id)
            .populate('client_id', 'full_name profile_image location created_at kyc_details kyc_status')
            .populate('hired_freelancer_id', 'full_name profile_image location');

        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found.' });
        }

        const [interest, stats] = await Promise.all([
            ProjectInterest.findOne({ project_id: id, freelancer_id: userId }),
            getProjectStats(id)
        ]);

        const isClient = project.client_id?._id?.toString() === userId;
        const isHired = project.hired_freelancer_id?._id?.toString() === userId;
        const isApplicant = !!interest;

        if (!isClient && !isHired && !isApplicant) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this project.'
            });
        }

        const responseData = {
            ...project.toObject(),
            isApplied: isApplicant,
            proposal_status: interest?.status,
            my_bid: interest?.bid_amount,
            delivery_time: interest?.delivery_time,
            portfolio_link: interest?.portfolio_link,
            bid_created_at: interest?.created_at,
            proposals: stats.proposals,
            stats
        };

        return res.status(200).json({
            success: true,
            message: 'Project details fetched successfully.',
            data: responseData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
