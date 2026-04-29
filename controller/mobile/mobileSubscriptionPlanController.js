const mongoose = require('mongoose');
const crypto = require('crypto');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const UserSubscription = require('../../models/UserSubscription');
const PaymentTransaction = require('../../models/PaymentTransaction');
const User = require('../../models/User');

const normalizeArray = (value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    return value ? [value] : [];
};

const serializePlan = (plan) => ({
    id: plan._id,
    _id: plan._id,
    name: plan.name,
    description: plan.description || '',
    price: plan.price || 0,
    duration_days: plan.duration_days || 0,
    billing_cycle: plan.billing_cycle || 'yearly',
    points_granted: plan.points_granted || 0,
    project_post_limit: plan.project_post_limit || 0,
    task_post_limit: plan.task_post_limit || 0,
    chat_limit: plan.chat_limit || 0,
    database_access_limit: plan.database_access_limit || 0,
    project_visit_limit: plan.project_visit_limit || 0,
    portfolio_visit_limit: plan.portfolio_visit_limit || 0,
    interest_click_limit: plan.interest_click_limit || 0,
    startup_idea_post_limit: plan.startup_idea_post_limit || 0,
    startup_idea_explore_limit: plan.startup_idea_explore_limit || 0,
    features: normalizeArray(plan.features),
    target_role: normalizeArray(plan.target_role),
    group: normalizeArray(plan.group),
    featured: !!plan.featured,
    badge: plan.badge || '',
    cta: plan.cta || 'Choose Plan',
    icon: plan.icon || 'Star',
    color_theme: plan.color_theme || 'orange',
    is_free_trial: Number(plan.price || 0) === 0
});

const buildPlanLimits = (plan) => ({
    points: Number(plan.points_granted || 0),
    project_posts: Number(plan.project_post_limit || 0),
    task_posts: Number(plan.task_post_limit || 0),
    chats: Number(plan.chat_limit || 0),
    database_access: Number(plan.database_access_limit || 0),
    project_visits: Number(plan.project_visit_limit || 0),
    portfolio_visits: Number(plan.portfolio_visit_limit || 0),
    startup_posts: Number(plan.startup_idea_post_limit || 0),
    idea_unlocks: Number(plan.startup_idea_explore_limit || 0),
    interest_clicks: Number(plan.interest_click_limit || 0)
});

const serializePlanWithLimits = (plan) => {
    const serializedPlan = serializePlan(plan);
    const limits = buildPlanLimits(plan);

    return {
        ...serializedPlan,
        badge: serializedPlan.badge,
        limits,
        access_limits: limits
    };
};

const buildDurationLeft = (startDateValue, endDateValue) => {
    const now = new Date();
    const startDate = startDateValue ? new Date(startDateValue) : null;
    const endDate = endDateValue ? new Date(endDateValue) : null;

    if (!endDate) {
        return {
            total_days: 0,
            days_left: 0,
            hours_left: 0,
            minutes_left: 0,
            milliseconds_left: 0,
            percentage_left: 0,
            is_expired: false
        };
    }

    const millisecondsLeft = Math.max(endDate.getTime() - now.getTime(), 0);
    const totalMilliseconds = startDate
        ? Math.max(endDate.getTime() - startDate.getTime(), 0)
        : millisecondsLeft;

    return {
        total_days: Math.ceil(totalMilliseconds / (1000 * 60 * 60 * 24)),
        days_left: Math.ceil(millisecondsLeft / (1000 * 60 * 60 * 24)),
        hours_left: Math.floor(millisecondsLeft / (1000 * 60 * 60)),
        minutes_left: Math.floor(millisecondsLeft / (1000 * 60)),
        milliseconds_left: millisecondsLeft,
        percentage_left: totalMilliseconds > 0
            ? Math.round((millisecondsLeft / totalMilliseconds) * 100)
            : 0,
        is_expired: millisecondsLeft <= 0
    };
};

const ACCESS_FIELDS_BY_ROLE = {
    freelancer: [
        { key: 'project_applications', label: 'Project Applications', plan: 'project_post_limit', remaining: 'remaining_project_posts', total: 'total_project_posts' },
        { key: 'task_slots', label: 'Gig / Task Slots', plan: 'task_post_limit', remaining: 'remaining_task_posts', total: 'total_task_posts' },
        { key: 'direct_chats', label: 'Client Conversations', plan: 'chat_limit', remaining: 'remaining_chats', total: 'total_chats' },
        { key: 'project_detail_unlocks', label: 'Project Detail Unlocks', plan: 'project_visit_limit', remaining: 'remaining_project_visits', total: 'total_project_visits' },
        { key: 'startup_idea_submissions', label: 'Startup Idea Submissions', plan: 'startup_idea_post_limit', remaining: 'remaining_startup_posts', total: 'total_startup_posts' },
        { key: 'startup_idea_unlocks', label: 'Startup Idea Unlocks', plan: 'startup_idea_explore_limit', remaining: 'remaining_idea_unlocks', total: 'total_idea_unlocks' }
    ],
    client: [
        { key: 'project_posts', label: 'Project Posts', plan: 'project_post_limit', remaining: 'remaining_project_posts', total: 'total_project_posts' },
        { key: 'task_posts', label: 'Task Posts', plan: 'task_post_limit', remaining: 'remaining_task_posts', total: 'total_task_posts' },
        { key: 'direct_chats', label: 'Freelancer Conversations', plan: 'chat_limit', remaining: 'remaining_chats', total: 'total_chats' },
        { key: 'database_access', label: 'Discovery Library Access', plan: 'database_access_limit', remaining: 'remaining_db_access', total: 'total_db_access' },
        { key: 'freelancer_profile_unlocks', label: 'Freelancer Profile Unlocks', plan: 'portfolio_visit_limit', remaining: 'remaining_portfolio_visits', total: 'total_portfolio_visits' },
        { key: 'startup_idea_submissions', label: 'Startup Idea Submissions', plan: 'startup_idea_post_limit', remaining: 'remaining_startup_posts', total: 'total_startup_posts' },
        { key: 'startup_idea_unlocks', label: 'Startup Idea Unlocks', plan: 'startup_idea_explore_limit', remaining: 'remaining_idea_unlocks', total: 'total_idea_unlocks' }
    ],
    investor: [
        { key: 'founder_conversations', label: 'Founder Conversations', plan: 'chat_limit', remaining: 'remaining_chats', total: 'total_chats' },
        { key: 'database_access', label: 'Discovery Library Access', plan: 'database_access_limit', remaining: 'remaining_db_access', total: 'total_db_access' },
        { key: 'startup_idea_unlocks', label: 'Startup Idea Unlocks', plan: 'startup_idea_explore_limit', remaining: 'remaining_idea_unlocks', total: 'total_idea_unlocks' }
    ],
    startup_creator: [
        { key: 'investor_conversations', label: 'Investor Conversations', plan: 'chat_limit', remaining: 'remaining_chats', total: 'total_chats' },
        { key: 'startup_idea_submissions', label: 'Startup Idea Submissions', plan: 'startup_idea_post_limit', remaining: 'remaining_startup_posts', total: 'total_startup_posts' },
        { key: 'startup_idea_unlocks', label: 'Startup Idea Unlocks', plan: 'startup_idea_explore_limit', remaining: 'remaining_idea_unlocks', total: 'total_idea_unlocks' }
    ]
};

const getRoleAccessFields = (role) => ACCESS_FIELDS_BY_ROLE[role] || ACCESS_FIELDS_BY_ROLE.freelancer;

const buildPlanAccess = (plan, role) => {
    return getRoleAccessFields(role).reduce((access, field) => {
        access[field.key] = Number(plan?.[field.plan] || 0);
        return access;
    }, {});
};

const buildSubscriptionAccess = (subscription, role) => {
    const plan = subscription.plan_id;

    return getRoleAccessFields(role).reduce((access, field) => {
        const total = Number(plan?.[field.plan] || subscription[field.total] || 0);
        const remaining = Number(subscription[field.remaining] || 0);
        const used = Math.max(total - remaining, 0);

        access[field.key] = total;
        access[`${field.key}_used`] = used;
        access[`${field.key}_remaining`] = remaining;

        return access;
    }, {});
};

const serializeWebsitePlanForRole = (plan, role, currentPlanId, currentSubscription) => {
    const isCurrentPlan = currentPlanId === String(plan._id);

    return {
        id: plan._id,
        _id: plan._id,
        name: plan.name,
        description: plan.description || '',
        price: plan.price || 0,
        duration_days: plan.duration_days || 0,
        billing_cycle: plan.billing_cycle || 'yearly',
        points_granted: plan.points_granted || 0,
        project_post_limit: plan.project_post_limit || 0,
        task_post_limit: plan.task_post_limit || 0,
        chat_limit: plan.chat_limit || 0,
        database_access_limit: plan.database_access_limit || 0,
        project_visit_limit: plan.project_visit_limit || 0,
        portfolio_visit_limit: plan.portfolio_visit_limit || 0,
        interest_click_limit: plan.interest_click_limit || 0,
        startup_idea_post_limit: plan.startup_idea_post_limit || 0,
        startup_idea_explore_limit: plan.startup_idea_explore_limit || 0,
        features: normalizeArray(plan.features),
        status: plan.status || 'enabled',
        target_role: normalizeArray(plan.target_role),
        group: normalizeArray(plan.group),
        featured: !!plan.featured,
        recommended: !!plan.featured,
        badge: plan.badge || '',
        cta: plan.cta || 'Choose Plan',
        icon: plan.icon || 'Star',
        color_theme: plan.color_theme || 'orange',
        current_plan: isCurrentPlan,
        current_access: isCurrentPlan && currentSubscription
            ? buildSubscriptionAccess(currentSubscription, role)
            : {},
        duration_left: isCurrentPlan && currentSubscription
            ? buildDurationLeft(currentSubscription.start_date, currentSubscription.end_date)
            : null
    };
};

const buildGroupedPlans = (plans) => {
    return plans.reduce((groups, plan) => {
        const planGroups = plan.group.length ? plan.group : ['Other Plans'];

        planGroups.forEach((groupName) => {
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(plan);
        });

        return groups;
    }, {});
};

const serializeSubscription = (subscription) => {
    const plan = subscription.plan_id;
    const endDate = subscription.end_date ? new Date(subscription.end_date) : null;
    const isExpired = endDate ? new Date() > endDate : false;

    return {
        id: subscription._id,
        _id: subscription._id,
        status: isExpired ? 'expired' : subscription.status,
        is_active: subscription.status === 'active' && !isExpired,
        is_expired: isExpired,
        start_date: subscription.start_date,
        end_date: subscription.end_date,
        plan: plan ? serializePlan(plan) : null,
        plan_id: plan?._id || subscription.plan_id,
        plan_name: plan?.name || 'No Active Plan',
        duration: buildDurationLeft(subscription.start_date, subscription.end_date),
        remaining: {
            project_posts: subscription.remaining_project_posts || 0,
            task_posts: subscription.remaining_task_posts || 0,
            chats: subscription.remaining_chats || 0,
            database_access: subscription.remaining_db_access || 0,
            project_visits: subscription.remaining_project_visits || 0,
            portfolio_visits: subscription.remaining_portfolio_visits || 0,
            startup_posts: subscription.remaining_startup_posts || 0,
            idea_unlocks: subscription.remaining_idea_unlocks || 0,
            interest_clicks: subscription.remaining_interest_clicks || 0
        },
        total: {
            project_posts: Number(plan?.project_post_limit || subscription.total_project_posts || 0),
            task_posts: Number(plan?.task_post_limit || subscription.total_task_posts || 0),
            chats: Number(plan?.chat_limit || subscription.total_chats || 0),
            database_access: Number(plan?.database_access_limit || subscription.total_db_access || 0),
            project_visits: Number(plan?.project_visit_limit || subscription.total_project_visits || 0),
            portfolio_visits: Number(plan?.portfolio_visit_limit || subscription.total_portfolio_visits || 0),
            startup_posts: Number(plan?.startup_idea_post_limit || subscription.total_startup_posts || 0),
            idea_unlocks: Number(plan?.startup_idea_explore_limit || subscription.total_idea_unlocks || 0),
            interest_clicks: Number(plan?.interest_click_limit || subscription.total_interest_clicks || 0)
        }
    };
};

/**
 * @desc    Get enabled subscription plans for mobile app
 * @route   GET /api/mobile/subscription-plans
 * @access  Public
 */
exports.getMobileSubscriptionPlans = async (req, res) => {
    try {
        const { role, group, billing_cycle } = req.query;
        const query = { status: 'enabled' };

        if (role) {
            query.target_role = { $in: [role, 'both'] };
        }

        if (group) {
            query.group = group;
        }

        if (billing_cycle) {
            query.billing_cycle = billing_cycle;
        }

        const plans = await SubscriptionPlan.find(query)
            .sort({ price: 1, createdAt: 1 })
            .lean();

        const data = plans.map(serializePlanWithLimits);

        res.status(200).json({
            success: true,
            count: data.length,
            data,
            groups: buildGroupedPlans(data)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get logged-in user's role and matching enabled subscription plans
 * @route   GET /api/mobile/subscription-plans/for-me
 * @access  Private
 */
exports.getMobileSubscriptionPlansForMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('role roles');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const role = Array.isArray(user.roles) && user.roles.length > 0
            ? user.roles[0]
            : (user.role || 'freelancer');

        const currentSubscription = await UserSubscription.findOne({
            user_id: req.user.id,
            status: 'active',
            end_date: { $gt: new Date() }
        })
            .populate('plan_id')
            .sort({ createdAt: -1 })
            .lean();

        const currentPlanValue = currentSubscription?.plan_id?._id || currentSubscription?.plan_id;
        const currentPlanId = currentPlanValue ? String(currentPlanValue) : null;

        const plans = await SubscriptionPlan.find({
            status: 'enabled',
            target_role: { $in: [role, 'both'] }
        })
            .sort({ price: 1, createdAt: 1 })
            .lean();

        const data = plans.map((plan) => (
            serializeWebsitePlanForRole(plan, role, currentPlanId, currentSubscription)
        ));

        res.status(200).json({
            success: true,
            role,
            current_plan_id: currentPlanId,
            has_subscription: !!currentSubscription,
            count: data.length,
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get one enabled subscription plan for mobile app
 * @route   GET /api/mobile/subscription-plans/:id
 * @access  Public
 */
exports.getMobileSubscriptionPlanById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid Plan ID format' });
        }

        const plan = await SubscriptionPlan.findOne({
            _id: req.params.id,
            status: 'enabled'
        }).lean();

        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        res.status(200).json({ success: true, data: serializePlanWithLimits(plan) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get current user's subscription plan for mobile app
 * @route   GET /api/mobile/subscription-plans/current
 * @access  Private
 */
exports.getMobileCurrentSubscriptionPlan = async (req, res) => {
    try {
        const subscription = await UserSubscription.findOne({
            user_id: req.user.id
        })
            .populate('plan_id')
            .sort({ createdAt: -1 })
            .lean();

        if (!subscription) {
            return res.status(200).json({
                success: true,
                has_subscription: false,
                data: null,
                message: 'No subscription found'
            });
        }

        const data = serializeSubscription(subscription);

        res.status(200).json({
            success: true,
            has_subscription: data.is_active,
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Complete mobile subscription upgrade after Flutter SDK payment
 * @route   POST /api/mobile/subscription-plans/upgrade
 * @access  Private
 */
exports.completeMobileSubscriptionUpgrade = async (req, res) => {
    try {
        const { planId, txnid, amount, payment_method, gateway_response } = req.body;

        if (!planId || !txnid || amount === undefined) {
            return res.status(400).json({
                success: false,
                message: 'planId, txnid and amount are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(planId)) {
            return res.status(400).json({ success: false, message: 'Invalid planId' });
        }

        const user = await User.findById(req.user.id);
        const plan = await SubscriptionPlan.findById(planId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        const paidAmount = Number(amount);
        if (!Number.isFinite(paidAmount) || paidAmount < 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        if (Number(plan.price || 0) !== paidAmount) {
            return res.status(400).json({
                success: false,
                message: `Amount mismatch. Expected ${plan.price}, received ${paidAmount}`
            });
        }

        const existingTransaction = await PaymentTransaction.findOne({ txnid });
        if (existingTransaction) {
            return res.status(409).json({
                success: false,
                message: 'Transaction already recorded',
                transaction_id: existingTransaction._id
            });
        }

        const transaction = await PaymentTransaction.create({
            user_id: user._id,
            plan_id: plan._id,
            payment_id: `MOB${Date.now()}${crypto.randomBytes(4).toString('hex')}`,
            txnid,
            amount: paidAmount,
            status: 'success',
            easebuzz_response: gateway_response || req.body,
            payment_method: payment_method || 'mobile_flutter_sdk'
        });

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + Number(plan.duration_days || 0));

        const bonusPoints = Number(plan.points_granted || 0);
        user.total_points = Number(user.total_points || 0) + bonusPoints;

        await UserSubscription.findOneAndUpdate(
            { user_id: user._id },
            {
                plan_id: plan._id,
                status: 'active',
                start_date: startDate,
                end_date: endDate,
                remaining_project_posts: Number(plan.project_post_limit || 0),
                remaining_task_posts: Number(plan.task_post_limit || 0),
                remaining_chats: Number(plan.chat_limit || 0),
                remaining_db_access: Number(plan.database_access_limit || 0),
                remaining_interest_clicks: Number(plan.interest_click_limit || 0),
                remaining_project_visits: Number(plan.project_visit_limit || 0),
                remaining_portfolio_visits: Number(plan.portfolio_visit_limit || 0),
                remaining_startup_posts: Number(plan.startup_idea_post_limit || 0),
                remaining_idea_unlocks: Number(plan.startup_idea_explore_limit || 0),
                total_project_posts: Number(plan.project_post_limit || 0),
                total_task_posts: Number(plan.task_post_limit || 0),
                total_chats: Number(plan.chat_limit || 0),
                total_db_access: Number(plan.database_access_limit || 0),
                total_interest_clicks: Number(plan.interest_click_limit || 0),
                total_project_visits: Number(plan.project_visit_limit || 0),
                total_portfolio_visits: Number(plan.portfolio_visit_limit || 0),
                total_startup_posts: Number(plan.startup_idea_post_limit || 0),
                total_idea_unlocks: Number(plan.startup_idea_explore_limit || 0),
                reminder_sent_10d: false,
                reminder_sent_3d: false,
                reminder_sent_exp: false
            },
            { upsert: true, new: true }
        );

        user.subscription_details = {
            plan_name: plan.name,
            status: 'active',
            start_date: startDate,
            end_date: endDate,
            project_credits: Number(plan.project_visit_limit || 0),
            portfolio_credits: Number(plan.portfolio_visit_limit || 0),
            task_credits: Number(plan.task_post_limit || 0),
            chat_credits: Number(plan.chat_limit || 0),
            db_credits: Number(plan.database_access_limit || 0)
        };

        if (plan.target_role && plan.target_role.length > 0) {
            plan.target_role.forEach((role) => {
                if (role === 'both') {
                    ['client', 'freelancer'].forEach((r) => {
                        if (!user.roles.includes(r)) user.roles.push(r);
                    });
                } else if (!user.roles.includes(role)) {
                    user.roles.push(role);
                }
            });
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: `${plan.name} activated successfully`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
