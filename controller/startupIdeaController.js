const StartupIdea = require('../models/StartupIdea');
const User = require('../models/User');
const SubscriptionUnlock = require('../models/SubscriptionUnlock');
const Message = require('../models/Message');

// @desc    Submit a new startup idea
// @route   POST /api/startup-ideas
// @access  Private (Freelancer/Client)
exports.submitIdea = async (req, res) => {
    try {
        const {
            category, title, shortDescription, detailedDescription,
            problem, solution, uniqueness, targetAudience,
            marketSize, competitorAnalysis, fundingAmount,
            useOfFunds, milestones, ndaRequired
        } = req.body;

        let signedNDA = null;
        if (req.file) {
            signedNDA = `/${req.file.destination}${req.file.filename}`.replace('//', '/');
        }

        const newIdea = await StartupIdea.create({
            creator: req.user._id,
            category,
            title,
            shortDescription,
            detailedDescription,
            problem,
            solution,
            uniqueness,
            targetAudience,
            marketSize,
            competitorAnalysis,
            fundingAmount,
            useOfFunds,
            milestones,
            ndaRequired,
            signedNDA,
            status: 'pending' // Admin approval required
        });

        res.status(201).json({
            success: true,
            message: 'Idea submitted successfully and is pending admin approval',
            data: newIdea
        });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// @desc    Get all startup ideas (Filtered by admin)
// @route   GET /api/startup-ideas
// @access  Public
exports.getApprovedIdeas = async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = { status: 'approved' };

        if (category && category !== 'All') {
            query.category = category;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { shortDescription: { $regex: search, $options: 'i' } }
            ];
        }

        const ideas = await StartupIdea.find(query)
            .populate('creator', 'full_name profile_image')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: ideas.length, data: ideas });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get single idea details
// @route   GET /api/startup-ideas/:id
// @access  Private
exports.getIdeaById = async (req, res) => {
    try {
        const idea = await StartupIdea.findById(req.params.id)
            .populate('creator', 'full_name profile_image bio location');

        if (!idea) {
            return res.status(404).json({ success: false, message: 'Idea not found' });
        }

        // Increment views
        idea.views += 1;
        await idea.save();

        // Check if user has unlocked contact
        const isUnlocked = await SubscriptionUnlock.findOne({
            user_id: req.user._id,
            target_id: idea._id,
            target_type: 'startup_idea'
        });

        const ideaObj = idea.toObject();
        if (!isUnlocked && (!req.user || idea.creator._id.toString() !== req.user._id.toString())) {
            // Mask contact details if not unlocked and not creator
            if (ideaObj.creator) {
                delete ideaObj.creator.phone_number;
                delete ideaObj.creator.email;
            }
        } else {
            // Already unlocked or is creator, allow contact info
            const creator = await User.findById(idea.creator._id).select('phone_number email');
            if (ideaObj.creator) {
                ideaObj.creator.phone_number = creator.phone_number;
                ideaObj.creator.email = creator.email;
            }
        }
        
        ideaObj.isUnlocked = !!isUnlocked;

        res.json({ success: true, data: ideaObj });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Unlock contact for an idea
// @route   POST /api/startup-ideas/:id/unlock
// @access  Private
exports.unlockContact = async (req, res) => {
    try {
        const idea = await StartupIdea.findById(req.params.id);
        if (!idea) {
            return res.status(404).json({ success: false, message: 'Idea not found' });
        }

        if (idea.creator.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot unlock your own idea' });
        }

        // Check if already unlocked
        const alreadyUnlocked = await SubscriptionUnlock.findOne({
            user_id: req.user._id,
            target_id: idea._id,
            target_type: 'startup_idea'
        });

        if (alreadyUnlocked) {
            const creator = await User.findById(idea.creator).select('phone_number email');
            return res.json({ success: true, message: 'Already unlocked', contact: creator });
        }

        const cost = 20; 
        const user = await User.findById(req.user._id);

        if (user.total_points < cost) {
            return res.status(400).json({ success: false, message: 'Insufficient points' });
        }

        user.total_points -= cost;
        await user.save();

        await SubscriptionUnlock.create({
            user_id: req.user._id,
            target_id: idea._id,
            target_type: 'startup_idea'
        });

        if (!idea.contacts.includes(req.user._id)) {
            idea.contacts.push(req.user._id);
            await idea.save();
        }

        const creator = await User.findById(idea.creator).select('phone_number email');
        res.json({ success: true, message: 'Contact unlocked successfully', contact: creator, remainingPoints: user.total_points });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get user's own ideas
// @route   GET /api/startup-ideas/my-ideas
// @access  Private
exports.getMyIdeas = async (req, res) => {
    try {
        const { status } = req.query;
        let query = { creator: req.user._id };
        if (status) query.status = status;

        const ideas = await StartupIdea.find(query).sort({ createdAt: -1 });
        res.json({ success: true, count: ideas.length, data: ideas });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get dashboard stats for startup creator
// @route   GET /api/startup-ideas/my-stats
// @access  Private (Startup Creator)
exports.getCreatorStats = async (req, res) => {
    try {
        const totalIdeas = await StartupIdea.countDocuments({ creator: req.user._id });
        const approvedCount = await StartupIdea.countDocuments({ creator: req.user._id, status: 'approved' });
        
        // Find how many unique investors have unlocked contact or tracked ideas
        const ideaIds = await StartupIdea.find({ creator: req.user._id }).distinct('_id');
        const investorLeadsCount = await SubscriptionUnlock.countDocuments({ target_id: { $in: ideaIds }, target_type: 'startup_idea' });

        const unreadCount = await Message.countDocuments({ receiver: req.user._id, isRead: false });
        res.json({
            success: true,
            data: {
                totalIdeas,
                approved: approvedCount,
                investorLeads: investorLeadsCount,
                profileScore: '88%', // Mock score for now
                unreadMessages: unreadCount
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Update startup idea (for creator)
// @route   PUT /api/startup-ideas/:id
// @access  Private (Creator)
exports.updateIdea = async (req, res) => {
    try {
        let idea = await StartupIdea.findById(req.params.id);
        if (!idea) {
            return res.status(404).json({ success: false, message: 'Idea not found' });
        }

        if (idea.creator.toString() !== req.user._id.toString()) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        idea = await StartupIdea.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.json({ success: true, data: idea });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
