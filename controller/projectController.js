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
        const { category, location, experience_level, search, budget_range } = req.query;
        let query = { status: 'live' };

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
            .populate('client_id', 'full_name')
            .sort({ createdAt: -1 });
            
        // Map to include proposals count (Interest clicks)
        const projectData = await Promise.all(projects.map(async (project) => {
            const proposals = await ProjectInterest.countDocuments({ project_id: project._id });
            return {
                ...project.toObject(),
                proposals
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
        const project = await Project.findById(req.params.id).populate('client_id', 'full_name profile_image');
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found' });
        }
        res.json({ success: true, data: project });
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
        const user = await User.findById(userId);

        if (user.roles.includes('client')) {
            const projects = await Project.find({ client_id: userId }).sort({ createdAt: -1 });
            
            // Populate proposal count for each
            const projectsWithStats = await Promise.all(projects.map(async (p) => {
                const proposals = await ProjectInterest.countDocuments({ project_id: p._id });
                return { ...p.toObject(), proposals };
            }));

            return res.json({ success: true, data: projectsWithStats });
        }

        if (user.roles.includes('freelancer')) {
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
