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
            useOfFunds, milestones, ndaRequired, youtubeUrl
        } = req.body;
        
        const user = await User.findById(req.user.id || req.user._id);

        if (user.role === 'investor') {
            return res.status(403).json({
                success: false,
                message: 'Investors cannot submit startup ideas'
            });
        }

        if (!user.kyc_details?.is_verified) {
            return res.status(403).json({
                success: false,
                message: 'KYC check required to submit startup ideas. Please complete your profile.'
            });
        }

        // Subscription Limit Check
        const UserSubscription = require('../models/UserSubscription');
        const userSubscription = await UserSubscription.findOne({
            user_id: user._id,
            status: 'active',
            end_date: { $gt: new Date() }
        }).populate('plan_id');

        if (userSubscription?.plan_id) {
            const planLimit = Number(userSubscription.plan_id.startup_idea_post_limit || 0);
            const usedStartupPosts = await StartupIdea.countDocuments({ creator: user._id });
            const expectedRemainingPosts = Math.max(planLimit - usedStartupPosts, 0);

            if (expectedRemainingPosts > (userSubscription.remaining_startup_posts || 0)) {
                userSubscription.remaining_startup_posts = expectedRemainingPosts;
                await userSubscription.save();
            }
        }

        if (!userSubscription || userSubscription.remaining_startup_posts <= 0) {
            return res.status(403).json({
                success: false,
                message: 'No remaining startup idea posts in your subscription. Please upgrade your plan.'
            });
        }

        const signedNdaFile = req.files?.signednda?.[0];
        const pitchDeckFile = req.files?.pitchDeck?.[0];
        const ideaImageFiles = req.files?.ideaImages || [];
        const legacyAttachments = req.files?.attachments || [];

        const resolvedPitchDeckFile = pitchDeckFile
            || legacyAttachments.find(file => /\.(pdf|ppt|pptx)$/i.test(file.originalname || ''));

        const resolvedIdeaImageFiles = ideaImageFiles.length > 0
            ? ideaImageFiles
            : legacyAttachments.filter(file => file.mimetype?.startsWith('image/'));

        let signedNDA = null;
        if (signedNdaFile) {
            signedNDA = `/${signedNdaFile.destination}${signedNdaFile.filename}`.replace('//', '/');
        }

        const pitchDeck = resolvedPitchDeckFile
            ? `/${resolvedPitchDeckFile.destination}${resolvedPitchDeckFile.filename}`.replace('//', '/')
            : null;

        const ideaImages = resolvedIdeaImageFiles.map(file =>
            `/${file.destination}${file.filename}`.replace('//', '/')
        );

        // Deduct from subscription
        userSubscription.remaining_startup_posts -= 1;
        await userSubscription.save();

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
            pitchDeck,
            youtubeUrl,
            ideaImages,
            attachments: ideaImages,
            status: 'approved' // Approved by default as requested
        });

        res.status(201).json({
            success: true,
            message: 'Idea submitted successfully and is now live on the platform',
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

        const rawIdeas = await StartupIdea.find(query)
            .populate('creator', 'full_name profile_image')
            .sort({ createdAt: -1 });

        // Filter out ideas where the creator document no longer exists
        const ideas = rawIdeas.filter(idea => idea.creator);

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

        if (!idea.creator) {
            return res.status(404).json({ success: false, message: 'Concept owner not found. This concept may be inactive.' });
        }

        // Increment views
        idea.views += 1;
        await idea.save();

        const isUnlocked = await SubscriptionUnlock.findOne({
            user_id: req.user._id,
            target_id: idea._id,
            target_type: 'startup_idea'
        });

        const ideaObj = idea.toObject();
        const creatorId = idea.creator?._id || idea.creator;
        const isOwner = req.user && creatorId?.toString() === req.user._id.toString();

        if (!isUnlocked && !isOwner) {
            // Mask contact details
            if (ideaObj.creator) {
                delete ideaObj.creator.phone_number;
                delete ideaObj.creator.email;
            }
            // Mask sensitive business details
            ideaObj.problem = "Unlock detailed roadmap to view the defined problem statement.";
            ideaObj.solution = "Unlock detailed roadmap to view the proposed solution.";
            ideaObj.uniqueness = "Unlock detailed roadmap to view why this concept is unique.";
            ideaObj.useOfFunds = "Unlock detailed roadmap to see capital allocation.";
            ideaObj.milestones = "Unlock detailed roadmap to view tactical milestones.";
            ideaObj.marketSize = "Restricted";
        } else if (creatorId) {
            // Already unlocked or is creator, allow contact info
            const creator = await User.findById(creatorId).select('phone_number email');
            if (ideaObj.creator && creator) {
                ideaObj.creator.phone_number = creator.phone_number;
                ideaObj.creator.email = creator.email;
            }
        }
        
        ideaObj.isUnlocked = !!isUnlocked || isOwner;

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

        // Check Subscription limit for unlocking
        const UserSubscription = require('../models/UserSubscription');
        const userSub = await UserSubscription.findOne({
            user_id: req.user._id,
            status: 'active',
            end_date: { $gt: new Date() }
        });

        if (!userSub || userSub.remaining_idea_unlocks <= 0) {
            return res.status(403).json({
                success: false,
                message: 'No remaining idea unlocks in your subscription. Please upgrade your plan.'
            });
        }

        // Deduct from subscription
        userSub.remaining_idea_unlocks -= 1;
        await userSub.save();

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
        res.json({ success: true, message: 'Contact unlocked successfully', contact: creator });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get user's own ideas
// @route   GET /api/startup-ideas/my-ideas
// @access  Private
exports.getMyIdeas = async (req, res) => {
    try {
        const { status, category, search } = req.query;
        let query = { creator: req.user._id };
        if (status) query.status = status;

        if (category) {
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
