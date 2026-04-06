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

        // Deduct points (optional logic if required)
        // For now based on your initial prompt logic

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
            .populate('client_id', 'full_name profile_image created_at kyc_details')
            .sort({ createdAt: -1 });
            
        // Get user ID if logged in (passed via optional auth middleware)
        const userId = req.user?.id;

        // Map to include proposals count (Interest clicks), isUnlocked, and isApplied status
        const projectData = await Promise.all(projects.map(async (project) => {
            const [proposals, unlock, interest] = await Promise.all([
                ProjectInterest.countDocuments({ project_id: project._id }),
                userId ? SubscriptionUnlock.findOne({ user_id: userId, target_id: project._id }) : null,
                userId ? ProjectInterest.findOne({ project_id: project._id, freelancer_id: userId }) : null
            ]);

            return {
                ...project.toObject(),
                proposals,
                isUnlocked: !!unlock,
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
        const project = await Project.findById(req.params.id).populate('client_id', 'full_name profile_image created_at kyc_details');
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        
        const proposals = await ProjectInterest.countDocuments({ project_id: req.params.id });
        
        res.json({ 
            success: true, 
            data: {
                ...project.toObject(),
                proposals 
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

        // Deduct limit
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

// @desc    Get my projects (Client) or interested projects (Freelancer)
// @route   GET /api/projects/my
// @access  Private
exports.getMyProjects = async (req, res) => {
    try {
        const userId = req.user.id;
        const requestedRole = req.query.role; // 'client' or 'freelancer'

        if (requestedRole === 'client') {
            const projects = await Project.find({ client_id: userId }).sort({ createdAt: -1 });
            
            // Populate proposal count for each
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

        // Default logic if no query param
        const user = await User.findById(userId);
        if (user.roles.includes('client')) {
            const projects = await Project.find({ client_id: userId }).sort({ createdAt: -1 });
            return res.json({ success: true, data: projects });
        }

        if (user.roles.includes('freelancer')) {
            const interests = await ProjectInterest.find({ freelancer_id: userId }).populate('project_id');
            return res.json({ success: true, data: interests.map(i => i.project_id) });
        }

        res.status(400).json({ success: false, message: 'Invalid role' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Get all proposals for a project (Owner Only)
// @route   GET /api/projects/:id/proposals
// @access  Private/Client
exports.getProjectProposals = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        if (project.client_id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Only project owners can view proposals' });
        }

        const proposals = await ProjectInterest.find({ project_id: req.params.id })
            .populate('freelancer_id', 'full_name profile_image created_at kyc_details')
            .sort({ bid_amount: 1 }); // Sorted by lowest bid by default

        res.json({ success: true, data: proposals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Award project to a freelancer
// @route   PUT /api/projects/:id/award/:proposalId
// @access  Private/Client
exports.awardProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        if (project.client_id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Only project owners can award projects' });
        }

        if (project.status === 'closed') {
            return res.status(400).json({ success: false, message: 'Project is already closed/awarded' });
        }

        const proposal = await ProjectInterest.findById(req.params.proposalId);
        if (!proposal || proposal.project_id.toString() !== req.params.id) {
            return res.status(404).json({ success: false, message: 'Proposal not found' });
        }

        // 1. Mark the winning proposal as awarded (pending acceptance)
        proposal.status = 'awarded';
        await proposal.save();

        // 2. Mark the project as awarded/closed and save the winner
        project.status = 'closed';
        project.hired_freelancer_id = proposal.freelancer_id;
        await project.save();

        // 3. Expire all other proposals for this project
        await ProjectInterest.updateMany(
            { project_id: req.params.id, _id: { $ne: req.params.proposalId } },
            { status: 'expired' }
        );

        res.json({ success: true, message: 'Project successfully awarded to freelancer. Awaiting their acceptance.', data: proposal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Freelancer accepts a project award
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

        // 1. Mark the proposal as accepted
        proposal.status = 'accepted';
        await proposal.save();

        res.json({ success: true, message: 'Project award accepted! You can now start working.', data: proposal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark project as completed
// @route   PUT /api/projects/:id/complete
// @access  Private
exports.completeProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }

        const isOwner = project.client_id.toString() === req.user.id;
        const isHired = project.hired_freelancer_id?.toString() === req.user.id;

        if (!isOwner && !isHired) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        project.status = 'completed';
        await project.save();

        // Also mark the proposal as completed
        await ProjectInterest.findOneAndUpdate(
            { project_id: req.params.id, freelancer_id: project.hired_freelancer_id },
            { status: 'accepted' } // Already accepted, could have a 'completed' status too but for now let's keep it accepted
        );

        res.json({ success: true, message: 'Project marked as completed!', data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
