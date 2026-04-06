const User = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionUnlock = require('../models/SubscriptionUnlock');

// @desc    Check if content is unlocked for user
// @route   GET /api/subscription/is-unlocked/:targetId
// @access  Private
exports.checkUnlockStatus = async (req, res) => {
    try {
        const { targetId } = req.params;
        const mongoose = require('mongoose');

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid target ID provided' 
            });
        }

        const unlock = await SubscriptionUnlock.findOne({
            user_id: req.user.id,
            target_id: targetId
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
        const mongoose = require('mongoose');

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid target ID provided for unlocking' 
            });
        }

        // 1. Check if already unlocked
        const existingUnlock = await SubscriptionUnlock.findOne({
            user_id: userId,
            target_id: targetId
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
            user_id: userId
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
            user_id: userId,
            target_id: targetId,
            target_type: targetType
        });

        // 6. Sync redundant credits in User model if they exist
        const syncUser = await User.findById(userId);
        if (syncUser && syncUser.subscription_details) {
            if (targetType === 'project') {
                syncUser.subscription_details.project_credits = subscription.remaining_project_visits;
            } else if (targetType === 'freelancer') {
                syncUser.subscription_details.portfolio_credits = subscription.remaining_portfolio_visits;
            }
            syncUser.markModified('subscription_details');
            await syncUser.save();
        }

        const user = await User.findById(userId);

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
