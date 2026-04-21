const SubscriptionPlan = require('../models/SubscriptionPlan');

// @desc    Get all active subscription plans
// @route   GET /api/subscription-plans
// @access  Public or Private
exports.getSubscriptionPlans = async (req, res) => {
    try {
        const { role } = req.query;
        let query = { status: 'enabled' };

        if (role) {
            query.target_role = { $in: [role, 'both'] };
        }

        const plans = await SubscriptionPlan.find(query).sort({ price: 1 });
        res.json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Admin only: Get ALL plans
exports.getAllPlansAdmin = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find().sort({ price: 1 });
        res.json({ success: true, count: plans.length, data: plans });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.create(req.body);
        res.status(201).json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSubscriptionPlan = async (req, res) => {
    try {
        const UserSubscription = require('../models/UserSubscription');

        // Fetch the current plan BEFORE updating so we can compare old vs new limits
        const oldPlan = await SubscriptionPlan.findById(req.params.id);
        if (!oldPlan) return res.status(404).json({ success: false, message: 'Plan not found' });

        // Apply the update
        const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        // ── Resync active subscriptions ─────────────────────────────────────────
        // Map: plan field → UserSubscription total/remaining fields
        const limitMap = [
            { plan: 'project_post_limit',         total: 'total_project_posts',     remaining: 'remaining_project_posts'    },
            { plan: 'task_post_limit',             total: 'total_task_posts',        remaining: 'remaining_task_posts'       },
            { plan: 'chat_limit',                  total: 'total_chats',             remaining: 'remaining_chats'            },
            { plan: 'database_access_limit',       total: 'total_db_access',         remaining: 'remaining_db_access'        },
            { plan: 'project_visit_limit',         total: 'total_project_visits',    remaining: 'remaining_project_visits'   },
            { plan: 'portfolio_visit_limit',       total: 'total_portfolio_visits',  remaining: 'remaining_portfolio_visits' },
            { plan: 'startup_idea_post_limit',     total: 'total_startup_posts',     remaining: 'remaining_startup_posts'    },
            { plan: 'startup_idea_explore_limit',  total: 'total_idea_unlocks',      remaining: 'remaining_idea_unlocks'     },
            { plan: 'interest_click_limit',        total: 'total_interest_clicks',   remaining: 'remaining_interest_clicks'  },
        ];

        const activeSubscriptions = await UserSubscription.find({
            plan_id: updatedPlan._id,
            status: 'active'
        });

        let syncedCount = 0;
        for (const sub of activeSubscriptions) {
            const updates = {};
            for (const { plan, total, remaining } of limitMap) {
                const newTotal    = Number(updatedPlan[plan]  || 0);
                const oldTotal    = Number(oldPlan[plan]      || 0);
                const oldRemaining = Number(sub[remaining]    || 0);

                // How much has the user already consumed?
                const consumed = Math.max(0, oldTotal - oldRemaining);

                // New remaining = new total minus what was already consumed
                const newRemaining = Math.max(0, newTotal - consumed);

                updates[total]     = newTotal;
                updates[remaining] = newRemaining;
            }
            await UserSubscription.findByIdAndUpdate(sub._id, { $set: updates });
            syncedCount++;
        }
        // ────────────────────────────────────────────────────────────────────────

        res.json({
            success: true,
            data: updatedPlan,
            synced_subscriptions: syncedCount,
            message: `Plan updated. ${syncedCount} active subscription(s) resynced.`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteSubscriptionPlan = async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
        res.json({ success: true, message: 'Plan deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSubscriptionPlanById = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid Plan ID format' });
        }
        const plan = await SubscriptionPlan.findById(req.params.id);
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
        res.json({ success: true, data: plan });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
