const Project = require('../models/Project');
const ProjectInterest = require('../models/ProjectInterest');
const UserSubscription = require('../models/UserSubscription');
const PointTransaction = require('../models/PointTransaction');
const User = require('../models/User');

// @desc    Create a project
// @route   POST /api/projects
// @access  Private/Client
exports.createProject = async (req, res) => {
    try {
        const subscription = await UserSubscription.findOne({
            user_id: req.user.id,
            status: 'active'
        });

        const user = await User.findById(req.user.id);

        if (!user.kyc_details?.is_verified && user.kyc_status !== 'pending') {
             return res.status(403).json({
                success: false,
                message: 'KYC verification required to post projects. Please complete your profile.'
            });
        }

        if (!subscription || subscription.remaining_project_posts <= 0) {
            return res.status(403).json({
                success: false,
                message: 'Project post limit reached. Please upgrade your plan.'
            });
        }

        req.body.client_id = req.user.id;
        req.body.status = 'live';
        
        // Handle attachments
        if (req.files && req.files.length > 0) {
            req.body.attachments = req.files.map(file => `/${file.path.replace(/\\/g, '/')}`);
        }
        
        // Handle skills (if it's a string, convert to array from FormData)
        if (typeof req.body.skills_required === 'string') {
            try {
                req.body.skills_required = JSON.parse(req.body.skills_required);
            } catch (e) {
                req.body.skills_required = [req.body.skills_required];
            }
        }

        const project = await Project.create(req.body);

        // Deduct limit
        subscription.remaining_project_posts -= 1;
        await subscription.save();

        res.status(201).json({ success: true, data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get projects with filters
// @route   GET /api/projects
// @access  Public
exports.getProjects = async (req, res) => {
    try {
        const { category, location, experience_level, search, budget_range, is_featured, client_id } = req.query;
        let query = { status: 'live' };

        if (client_id) {
            query.client_id = client_id;
        }

        if (is_featured === 'true') {
            query.is_featured = true;
        }

        if (category && category !== 'All Categories') {
            query.category = category;
        }

        if (location && location !== 'All Locations') {
            query.location = { $regex: location, $options: 'i' };
        }

        if (experience_level) {
            query.experience_level = experience_level;
        }

        if (budget_range) {
            query.budget_range = budget_range;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        let projects = await Project.find(query)
            .populate({
                path: 'client_id',
                select: 'full_name profile_image created_at kyc_details is_suspended kyc_status',
                match: {
                    is_suspended: { $ne: true },
                    kyc_status: { $ne: 'rejected' }
                }
            })
            .sort({ createdAt: -1 });
            
        // Filter out projects where the client is suspended or rejected
        projects = projects.filter(project => project.client_id !== null);
            
        const userId = req.user?.id;

        const projectData = await Promise.all(projects.map(async (project) => {
            const [proposals, interest] = await Promise.all([
                ProjectInterest.countDocuments({ project_id: project._id }),
                userId ? ProjectInterest.findOne({ project_id: project._id, freelancer_id: userId }) : null
            ]);

            return {
                ...project.toObject(),
                proposals,
                isApplied: !!interest
            };
        }));

        res.json({ success: true, data: projectData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single project details
// @route   GET /api/projects/:id
// @access  Public
exports.getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('client_id', 'full_name profile_image created_at kyc_details')
            .populate('hired_freelancer_id', 'full_name profile_image location');
            
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        
        const Invitation = require('../models/Invitation');
        const [proposals, interviewing, invites] = await Promise.all([
            ProjectInterest.countDocuments({ project_id: req.params.id }),
            ProjectInterest.countDocuments({ project_id: req.params.id, status: 'interviewing' }),
            Invitation.countDocuments({ project_id: req.params.id })
        ]);
        
        const userId = req.user?.id;
        const interest = userId ? await ProjectInterest.findOne({ project_id: req.params.id, freelancer_id: userId }) : null;

        res.json({ 
            success: true, 
            data: {
                ...project.toObject(),
                proposals,
                isApplied: !!interest,
                stats: {
                    proposals,
                    interviewing,
                    invites
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Express interest in project
// @route   POST /api/projects/:id/interest
// @access  Private/Freelancer
exports.expressInterest = async (req, res) => {
    try {
        const subscription = await UserSubscription.findOne({
            user_id: req.user.id,
            status: 'active'
        });

        const user = await User.findById(req.user.id);

        if (!user.kyc_details?.is_verified && user.kyc_status !== 'pending') {
             return res.status(403).json({
                success: false,
                message: 'KYC verification required to apply for projects. Please complete your profile.'
            });
        }

        if (!subscription || subscription.remaining_interest_clicks <= 0) {
            return res.status(403).json({
                success: false,
                message: 'Interest clicks limit reached. Please upgrade your plan.'
            });
        }

        const interest = await ProjectInterest.create({
            project_id: req.params.id,
            freelancer_id: req.user.id,
            message: req.body.message,
            bid_amount: Number(req.body.bid_amount),
            delivery_time: req.body.delivery_time,
            portfolio_link: req.body.portfolio_link
        });

        subscription.remaining_interest_clicks -= 1;
        await subscription.save();

        res.status(201).json({ success: true, data: interest });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'You have already expressed interest in this project' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get my projects
// @route   GET /api/projects/my
// @access  Private
exports.getMyProjects = async (req, res) => {
    try {
        const userId = req.user.id;
        const requestedRole = req.query.role;

        if (requestedRole === 'client') {
            const projects = await Project.find({ client_id: userId }).sort({ createdAt: -1 });
            const projectsWithStats = await Promise.all(projects.map(async (p) => {
                const proposals = await ProjectInterest.countDocuments({ project_id: p._id });
                return { ...p.toObject(), proposals };
            }));
            return res.json({ success: true, data: projectsWithStats });
        }

        if (requestedRole === 'freelancer') {
            const interests = await ProjectInterest.find({ freelancer_id: userId })
                .populate({
                    path: 'project_id',
                    populate: { path: 'client_id', select: 'full_name profile_image' }
                })
                .sort({ created_at: -1 });

            const formattedProjects = interests.map(interest => {
                if (!interest.project_id) return null;
                return {
                    ...interest.project_id.toObject(),
                    proposal_status: interest.status,
                    my_bid: interest.bid_amount,
                    bid_created_at: interest.created_at
                };
            }).filter(p => p !== null);

            return res.json({ success: true, data: formattedProjects });
        }

        res.status(400).json({ success: false, message: 'Invalid role' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all proposals for a project
// @route   GET /api/projects/:id/proposals
// @access  Private/Client
exports.getProjectProposals = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project || project.client_id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const proposals = await ProjectInterest.find({ project_id: req.params.id })
            .populate('freelancer_id', 'full_name profile_image location kyc_details')
            .sort({ created_at: -1 });

        res.json({ success: true, data: proposals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Award project
// @route   PUT /api/projects/:id/award/:proposalId
// @access  Private/Client
exports.awardProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project || project.client_id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        const proposal = await ProjectInterest.findById(req.params.proposalId);
        if (!proposal || proposal.project_id.toString() !== req.params.id) {
            return res.status(404).json({ success: false, message: 'Proposal not found' });
        }

        proposal.status = 'awarded';
        await proposal.save();

        project.status = 'closed';
        project.hired_freelancer_id = proposal.freelancer_id;
        await project.save();

        await ProjectInterest.updateMany(
            { project_id: req.params.id, _id: { $ne: req.params.proposalId } },
            { status: 'expired' }
        );

        res.json({ success: true, message: 'Project awarded successfully. Waiting for freelancer to accept.', data: proposal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Accept project award
// @route   PUT /api/projects/:id/accept
// @access  Private/Freelancer
exports.acceptProjectAward = async (req, res) => {
    try {
        const proposal = await ProjectInterest.findOne({
            project_id: req.params.id,
            freelancer_id: req.user.id,
            status: 'awarded'
        });

        if (!proposal) {
            return res.status(404).json({ success: false, message: 'Award not found or already accepted' });
        }

        proposal.status = 'accepted';
        await proposal.save();

        res.json({ success: true, message: 'Award accepted!', data: proposal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update project
// @route   PUT /api/projects/:id
// @access  Private/Client
exports.updateProject = async (req, res) => {
    try {
        let project = await Project.findById(req.params.id);
        if (!project || project.client_id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (req.files && req.files.length > 0) {
            const newAttachments = req.files.map(file => `/${file.path.replace(/\\/g, '/')}`);
            req.body.attachments = [...(project.attachments || []), ...newAttachments];
        }

        if (typeof req.body.skills_required === 'string') {
            try {
                req.body.skills_required = JSON.parse(req.body.skills_required);
            } catch (e) {
                req.body.skills_required = [req.body.skills_required];
            }
        }

        project = await Project.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Complete project
// @route   PUT /api/projects/:id/complete
// @access  Private
exports.completeProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        const isOwner = project.client_id.toString() === req.user.id;
        const isHired = project.hired_freelancer_id?.toString() === req.user.id;
        if (!isOwner && !isHired) return res.status(403).json({ success: false, message: 'Not authorized' });

        project.status = 'completed';
        await project.save();

        res.json({ success: true, message: 'Project completed', data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Submit review
// @route   POST /api/projects/:id/review
// @access  Private
exports.submitReview = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project || project.status !== 'completed') {
            return res.status(400).json({ success: false, message: 'Invalid project status for review' });
        }

        const { rating, comment } = req.body;
        const isClient = project.client_id.toString() === req.user.id;
        const isFreelancer = project.hired_freelancer_id?.toString() === req.user.id;

        if (isClient) {
            project.client_review = { rating, comment, created_at: Date.now() };
        } else if (isFreelancer) {
            project.freelancer_review = { rating, comment, created_at: Date.now() };
        } else {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        await project.save();
        res.json({ success: true, message: 'Review submitted', data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
