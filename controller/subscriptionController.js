const User = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionUnlock = require('../models/SubscriptionUnlock');
const StartupIdea = require('../models/StartupIdea');
const mongoose = require('mongoose');

const syncStartupCreditsFromPlan = async (subscription, userId) => {
    if (!subscription?.plan_id) return subscription;

    const plan = subscription.plan_id;
    const planPostLimit = Number(plan.startup_idea_post_limit || 0);
    const planUnlockLimit = Number(plan.startup_idea_explore_limit || 0);

    const usedStartupPosts = await StartupIdea.countDocuments({ creator: userId });
    const usedIdeaUnlocks = await SubscriptionUnlock.countDocuments({
        user_id: userId,
        target_type: 'startup_idea'
    });

    const expectedRemainingPosts = Math.max(planPostLimit - usedStartupPosts, 0);
    const expectedRemainingUnlocks = Math.max(planUnlockLimit - usedIdeaUnlocks, 0);
    let changed = false;

    if (expectedRemainingPosts > (subscription.remaining_startup_posts || 0)) {
        subscription.remaining_startup_posts = expectedRemainingPosts;
        changed = true;
    }

    if (expectedRemainingUnlocks > (subscription.remaining_idea_unlocks || 0)) {
        subscription.remaining_idea_unlocks = expectedRemainingUnlocks;
        changed = true;
    }

    if (changed) {
        await subscription.save();
    }

    return subscription;
};

// @desc    Check if content is unlocked for user
// @route   GET /api/subscription/is-unlocked/:targetId
// @access  Private
exports.checkUnlockStatus = async (req, res) => {
    try {
        const { targetId } = req.params;

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid target ID provided' 
            });
        }

        const unlock = await SubscriptionUnlock.findOne({
            user_id: req.user.id,
            target_id: new mongoose.Types.ObjectId(targetId)
        });

        res.status(200).json({
            success: true,
            isUnlocked: !!unlock
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Unlock a profile or project details (Deduct Credit)
// @route   POST /api/subscription/unlock
// @access  Private
exports.unlockContent = async (req, res) => {
    try {
        const { targetId, targetType } = req.body; // 'project' or 'freelancer'
        const userId = req.user.id;

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid target ID provided for unlocking' 
            });
        }

        const targetIdObj = new mongoose.Types.ObjectId(targetId);
        const userIdObj = new mongoose.Types.ObjectId(userId);

        // 1. Check if already unlocked
        const existingUnlock = await SubscriptionUnlock.findOne({
            user_id: userIdObj,
            target_id: targetIdObj,
            target_type: targetType
        });

        if (existingUnlock) {
            return res.status(200).json({
                success: true,
                message: 'Content already unlocked',
                unlock: existingUnlock
            });
        }

        // 2. Check active subscription
        const subscription = await UserSubscription.findOne({
            user_id: userIdObj
        });

        if (!subscription || subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Your subscription has expired. Please upgrade your plan to continue viewing details.',
                type: 'PLAN_EXPIRED'
            });
        }

        // 3. Check credits based on type
        const creditField = targetType === 'project' ? 'remaining_project_visits' : 'remaining_portfolio_visits';
        if (subscription[creditField] <= 0) {
            return res.status(403).json({
                success: false,
                message: `You have run out of ${targetType} visit credits. Please upgrade to a more advanced plan.`,
                type: 'OUT_OF_CREDITS'
            });
        }

        // 4. Deduct credit and save
        subscription[creditField] -= 1;
        await subscription.save();

        // 5. Create unlock record
        const unlock = await SubscriptionUnlock.create({
            user_id: userIdObj,
            target_id: targetIdObj,
            target_type: targetType
        });

        // 6. Sync redundant credits in User model if they exist
        const syncUser = await User.findById(userIdObj);
        if (syncUser && syncUser.subscription_details) {
            if (targetType === 'project') {
                syncUser.subscription_details.project_credits = subscription.remaining_project_visits;
            } else if (targetType === 'freelancer') {
                syncUser.subscription_details.portfolio_credits = subscription.remaining_portfolio_visits;
            }
            syncUser.markModified('subscription_details');
            await syncUser.save();
        }

        const user = await User.findById(userIdObj);

        res.status(201).json({
            success: true,
            message: `One ${targetType} visit credit deducted. ${subscription[creditField]} left.`,
            creditsLeft: subscription[creditField],
            user,
            unlock
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user's current subscription status and credits
// @route   GET /api/subscription/my-status
// @access  Private
exports.getMySubscription = async (req, res) => {
    try {
        const subscription = await UserSubscription.findOne({
            user_id: req.user.id
        }).populate('plan_id');

        if (!subscription) {
             return res.status(200).json({
                success: false,
                message: 'No subscription found'
            });
        }

        const isGracePeriod = subscription.status === 'active' && new Date() > new Date(subscription.end_date);
        await syncStartupCreditsFromPlan(subscription, req.user.id);

        res.status(200).json({
            success: true,
            subscription: {
                ...subscription.toObject(),
                plan_name: subscription.plan_id?.name || 'Starter Plan', // fallback
                is_grace_period: isGracePeriod
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
