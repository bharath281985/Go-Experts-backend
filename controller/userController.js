const User = require('../models/User');
const Project = require('../models/Project');
const Gig = require('../models/Gig');
const GigOrder = require('../models/GigOrder');
const UserSubscription = require('../models/UserSubscription');
const PointTransaction = require('../models/PointTransaction');
const Dispute = require('../models/Dispute');
const Invoice = require('../models/Invoice');
const SavedGig = require('../models/SavedGig');
const Withdrawal = require('../models/Withdrawal');
const ProjectInterest = require('../models/ProjectInterest');
const Review = require('../models/Review');

// @desc    Get all freelancers
// @route   GET /api/users/freelancers
// @access  Public
exports.getFreelancers = async (req, res) => {
    try {
        const { categories, skills, role, search } = req.query;
        let query = {
            $and: [
                { roles: 'freelancer' },
                { roles: { $nin: ['admin'] } }
            ],
            is_suspended: { $ne: true }
        };

        if (search) {
            query.$or = [
                { full_name: { $regex: search, $options: 'i' } },
                { bio: { $regex: search, $options: 'i' } },
                { role: { $regex: search, $options: 'i' } }
            ];
        }

        if (categories) {
            const categoryList = Array.isArray(categories) ? categories : [categories];
            const mongoose = require('mongoose');
            const Category = require('../models/Category');

            const resolvedCategoryIds = [];
            const categoryNamesToResolve = [];

            categoryList.forEach(c => {
                if (mongoose.Types.ObjectId.isValid(c)) {
                    resolvedCategoryIds.push(c);
                } else {
                    categoryNamesToResolve.push(c);
                }
            });

            if (categoryNamesToResolve.length > 0) {
                const foundCats = await Category.find({
                    name: { $in: categoryNamesToResolve }
                });
                foundCats.forEach(cat => resolvedCategoryIds.push(cat._id));
            }

            if (resolvedCategoryIds.length > 0) {
                query.categories = { $in: resolvedCategoryIds };
            } else if (categoryList.length > 0) {
                return res.json({ success: true, count: 0, data: [] });
            }
        }

        // Handle role as category name search
        if (role && role !== 'all') {
            const Category = require('../models/Category');
            const foundCategory = await Category.findOne({ 
                name: { $regex: new RegExp(`^${role}$`, 'i') } 
            });
            if (foundCategory) {
                query.categories = { $in: [foundCategory._id] };
            }
        }

        if (skills) {
            const skillList = Array.isArray(skills) ? skills : [skills];
            const mongoose = require('mongoose');
            const Skill = require('../models/Skill');
            
            // Separate valid IDs from skill names (slugs or names)
            const resolvedSkillIds = [];
            const skillNamesToResolve = [];

            skillList.forEach(s => {
                if (mongoose.Types.ObjectId.isValid(s)) {
                    resolvedSkillIds.push(s);
                } else {
                    skillNamesToResolve.push(s);
                }
            });

            // Resolve skill names to IDs by searching in the Skill model
            if (skillNamesToResolve.length > 0) {
                const foundSkills = await Skill.find({ 
                    $or: [
                        { name: { $in: skillNamesToResolve } },
                        { slug: { $in: skillNamesToResolve.map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')) } }
                    ]
                });
                foundSkills.forEach(skill => resolvedSkillIds.push(skill._id));
            }

            if (resolvedSkillIds.length > 0) {
                query.skills = { $in: resolvedSkillIds };
            } else if (skillList.length > 0) {
                // If we had skill names but none were found, return no results as the filter is invalid
                return res.json({ success: true, count: 0, data: [] });
            }
        }

        const freelancers = await User.find(query)
            .select('-password')
            .populate('categories', 'name')
            .populate('skills', 'name');
        res.json({ success: true, count: freelancers.length, data: freelancers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single freelancer details
// @route   GET /api/users/freelancers/:id
// @access  Public
exports.getFreelancerById = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const talentId = req.params.id;

        if (!talentId || talentId === 'undefined') {
            return res.status(400).json({ 
                success: false, 
                message: 'Freelancer ID or username is required' 
            });
        }

        let query = {
            $and: [
                { roles: 'freelancer' },
                { roles: { $nin: ['admin'] } }
            ],
            is_suspended: { $ne: true }
        };
        
        // If it's a valid ObjectId, search by _id, otherwise search by username
        if (mongoose.Types.ObjectId.isValid(talentId)) {
            query._id = talentId;
        } else {
            query.username = talentId.toLowerCase();
        }

        const freelancer = await User.findOne(query)
            .select('-password')
            .populate('categories', 'name')
            .populate('skills', 'name');

        if (!freelancer) {
            return res.status(404).json({ success: false, message: 'Freelancer not found' });
        }

        // Attach real review stats
        const Review = require('../models/Review');
        const reviewStats = await Review.aggregate([
            { $match: { freelancer_id: freelancer._id } },
            { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);
        const freelancerObj = freelancer.toObject();
        freelancerObj.review_score = reviewStats.length > 0 ? +reviewStats[0].avg.toFixed(1) : 0;
        freelancerObj.review_count = reviewStats.length > 0 ? reviewStats[0].count : 0;

        res.json({ success: true, data: freelancerObj });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get dashboard stats for user
// @route   GET /api/users/dashboard-stats
// @access  Private
exports.getUserStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId)
            .populate('categories', 'name')
            .populate('skills', 'name');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const stats = {
            _id: user._id,
            roles: user.roles,
            username: user.username,
            wallet_balance: user.wallet_balance || 0,
            total_points: user.total_points || 0,
            profile: {
                _id: user._id,
                full_name: user.full_name,
                username: user.username,
                email: user.email,
                phone_number: user.phone_number,
                profile_image: user.profile_image,
                bio: user.bio,
                location: user.location,
                role_title: user.role_title,
                hourly_rate: user.hourly_rate || 0,
                review_score: user.review_score || 0,
                review_count: user.review_count || 0,
                completed_projects: user.completed_projects || 0,
                happy_customers: user.happy_customers || 0,
                kyc_status: user.kyc_status,
                is_verified: Boolean(user.kyc_details?.is_verified),
                landing_page_image: user.landing_page_image,
                portfolio_count: Array.isArray(user.portfolio) ? user.portfolio.length : 0,
                categories: Array.isArray(user.categories)
                    ? user.categories.map((category) => category.name || category)
                    : [],
                skills: Array.isArray(user.skills)
                    ? user.skills.map((skill) => skill.name || skill)
                    : [],
                social_links: user.social_links || {}
            }
        };

        // Client stats
        if (user.roles.includes('client')) {
            const [projects, ordersAsBuyer, projectInterests, disputeCount] = await Promise.all([
                Project.find({ client_id: userId }),
                GigOrder.find({ buyer_id: userId }).sort({ createdAt: -1 }),
                ProjectInterest.find({ client_id: userId })
                    .populate('freelancer_id', 'full_name profile_image')
                    .populate('project_id', 'title')
                    .sort({ createdAt: -1 }),
                Dispute.countDocuments({ $or: [{ buyer: userId }, { seller: userId }] })
            ]);

            const completedProjects = projects.filter(p => p.status === 'completed').length;
            const liveProjects = projects.filter(p => p.status === 'live').length;
            const totalProjects = projects.length;

            // Spending Trend (Last 6 Months)
            const spendingTrend = [];
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
                const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

                const monthlyTotal = ordersAsBuyer
                    .filter(o => o.payment_status === 'paid' && o.createdAt >= monthStart && o.createdAt <= monthEnd)
                    .reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

                spendingTrend.push({ month: monthName, amount: monthlyTotal });
            }

            // Category Breakdown
            const categoriesMap = {};
            projects.forEach(p => {
                const cat = p.category || 'Other';
                categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
            });
            const categoryBreakdown = Object.keys(categoriesMap).map((name, index) => ({
                name,
                value: Math.round((categoriesMap[name] / totalProjects) * 100),
                color: ['#F24C20', '#044071', '#10b981', '#64748b', '#f59e0b', '#8b5cf6'][index % 6]
            }));

            // Recent Activity combined Feed
            const recentActivity = [];
            
            // Add Project Applications (Interests)
            projectInterests.slice(0, 3).forEach(interest => {
                recentActivity.push({
                    type: 'project',
                    title: `Application for "${interest.project_id?.title || 'Project'}"`,
                    time: interest.createdAt.toLocaleString(),
                    icon: 'Users',
                    color: 'text-blue-500'
                });
            });

            // Add Payments
            ordersAsBuyer.filter(o => o.payment_status === 'paid').slice(0, 2).forEach(order => {
                recentActivity.push({
                    type: 'payment',
                    title: `Payment: ₹${order.total_amount.toLocaleString()}`,
                    time: order.createdAt.toLocaleString(),
                    icon: 'IndianRupee',
                    color: 'text-green-500'
                });
            });

            stats.client = {
                total_projects: totalProjects,
                live_projects: liveProjects,
                completed_projects: completedProjects,
                total_spent: ordersAsBuyer
                    .filter(o => o.payment_status === 'paid')
                    .reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
                spending_trend: spendingTrend,
                category_breakdown: categoryBreakdown,
                recent_activity: recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5),
                ongoing_gig_orders: ordersAsBuyer.filter(o => ['pending', 'in_progress', 'delivered'].includes(o.status)).length,
                dispute_count: disputeCount
            };
        }

        // Freelancer stats
        if (user.roles.includes('freelancer')) {
            const [gigs, ordersAsSeller, hiredProjects, activeProposals, reviewSummary, disputeCount] = await Promise.all([
                Gig.find({ freelancer_id: userId }),
                GigOrder.find({ seller_id: userId })
                    .populate('gig_id', 'title')
                    .populate('buyer_id', 'full_name')
                    .sort({ createdAt: -1 }),
                Project.find({ hired_freelancer_id: userId }).sort({ updatedAt: -1 }),
                ProjectInterest.find({
                    freelancer_id: userId,
                    status: { $in: ['awarded', 'accepted'] }
                }).populate('project_id', 'title status updatedAt createdAt'),
                Review.aggregate([
                    { $match: { freelancer_id: user._id } },
                    {
                        $group: {
                            _id: null,
                            avg: { $avg: '$rating' },
                            count: { $sum: 1 }
                        }
                    }
                ]),
                Dispute.countDocuments({ $or: [{ buyer: userId }, { seller: userId }] })
            ]);
            
            // Calculate Current & Previous Month Earnings for Trend
            const now = new Date();
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            
            const currentMonthOrders = ordersAsSeller.filter(o => 
                (o.status === 'completed' || o.payment_status === 'paid') && o.createdAt >= startOfCurrentMonth
            );
            const lastMonthOrders = ordersAsSeller.filter(o => 
                (o.status === 'completed' || o.payment_status === 'paid') && o.createdAt >= startOfLastMonth && o.createdAt < startOfCurrentMonth
            );

            const currentMonthEarnings = currentMonthOrders.reduce((acc, curr) => acc + (curr.price || 0), 0);
            const lastMonthEarnings = lastMonthOrders.reduce((acc, curr) => acc + (curr.price || 0), 0);
            
            const earningsTrend = lastMonthEarnings === 0 ? 100 : Math.round(((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100);
            const completedGigOrders = ordersAsSeller.filter(o => o.status === 'completed');
            const completedProjectContracts = hiredProjects.filter(project => project.status === 'completed');
            const activeProjectContracts = activeProposals.filter((proposal) => proposal.project_id && proposal.project_id.status !== 'completed');
            const totalOrders = ordersAsSeller.length + hiredProjects.length;
            const totalCompletedWork = completedGigOrders.length + completedProjectContracts.length;
            const totalTrackedWork = totalOrders;
            const completionRate = totalTrackedWork > 0 ? Math.round((totalCompletedWork / totalTrackedWork) * 100) : 0;
            const completedWithDeadline = completedGigOrders.filter(order => order.delivery_date);
            const onTimeDelivery = completedWithDeadline.length > 0
                ? Math.round(
                    (completedWithDeadline.filter(order => new Date(order.updatedAt) <= new Date(order.delivery_date)).length / completedWithDeadline.length) * 100
                )
                : 0;
            const satisfaction = reviewSummary.length > 0 ? Number(reviewSummary[0].avg.toFixed(1)) : (user.review_score || 0);
            const reviewCount = reviewSummary.length > 0 ? reviewSummary[0].count : (user.review_count || 0);

            // Last 6 Months for Chart
            const chartData = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
                const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                
                const monthEarnings = ordersAsSeller
                    .filter(o => (o.status === 'completed' || o.payment_status === 'paid') && o.createdAt >= monthStart && o.createdAt <= monthEnd)
                    .reduce((acc, curr) => acc + (curr.price || 0), 0);
                
                chartData.push({ month: monthName, amount: monthEarnings });
            }

            stats.freelancer = {
                total_gigs: gigs.length,
                live_gigs: gigs.filter(g => g.status === 'live').length,
                total_orders: totalOrders,
                completed_projects: totalCompletedWork,
                total_earnings: ordersAsSeller
                    .filter(o => o.status === 'completed' || o.payment_status === 'paid')
                    .reduce((acc, curr) => acc + (curr.price || 0), 0),
                current_month_earnings: currentMonthEarnings,
                earnings_trend: earningsTrend,
                pending_payouts: ordersAsSeller
                    .filter(o => ['in_progress', 'delivered'].includes(o.status) && o.payment_status === 'paid')
                    .reduce((acc, curr) => acc + (curr.price || 0), 0),
                pipeline: {
                    in_progress: ordersAsSeller.filter(o => o.status === 'in_progress').length + activeProjectContracts.length,
                    delivered: ordersAsSeller.filter(o => o.status === 'delivered').length,
                    pending: ordersAsSeller.filter(o => o.status === 'pending').length
                },
                recent_orders: ordersAsSeller.slice(0, 3).map(o => ({
                    _id: o._id,
                    price: o.price,
                    status: o.status,
                    createdAt: o.createdAt,
                    gig_title: o.gig_id?.title || 'Gig Service',
                    client_name: o.buyer_id?.full_name || 'Anonymous Client'
                })),
                chart_data: chartData,
                profile_summary: {
                    portfolio_items: Array.isArray(user.portfolio) ? user.portfolio.length : 0,
                    skills_count: Array.isArray(user.skills) ? user.skills.length : 0,
                    categories_count: Array.isArray(user.categories) ? user.categories.length : 0,
                    hourly_rate: user.hourly_rate || 0,
                    review_count: reviewCount
                },
                performance: {
                    completion_rate: completionRate,
                    on_time_delivery: onTimeDelivery,
                    satisfaction
                },
                dispute_count: disputeCount
            };
        }

        // Subscription info
        const subscription = await UserSubscription.findOne({ user_id: userId, status: 'active' }).populate('plan_id');
        stats.subscription = subscription ? {
            plan_name: subscription.plan_id?.name || 'Active Plan',
            start_date: subscription.start_date,
            end_date: subscription.end_date,
            remaining_project_posts: subscription.remaining_project_posts,
            total_project_posts: subscription.plan_id?.project_post_limit ?? 0,
            remaining_interest_clicks: subscription.remaining_interest_clicks,
            total_interest_clicks: subscription.plan_id?.interest_click_limit ?? 0,
            remaining_project_visits: subscription.remaining_project_visits,
            total_project_visits: subscription.plan_id?.project_visit_limit ?? 0,
            remaining_portfolio_visits: subscription.remaining_portfolio_visits,
            total_portfolio_visits: subscription.plan_id?.portfolio_visit_limit ?? 0,
            status: subscription.status
        } : null;

        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        console.error('Get Stats Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user transactions
// @route   GET /api/users/transactions
// @access  Private
exports.getUserTransactions = async (req, res) => {
    try {
        const transactions = await PointTransaction.find({ user_id: req.user.id })
            .sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            data: transactions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add money to wallet
// @route   POST /api/users/add-money
// @access  Private
exports.addMoney = async (req, res) => {
    try {
        const { amount, description } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        const user = await User.findById(req.user.id);
        user.wallet_balance = (user.wallet_balance || 0) + amount;
        await user.save();

        await PointTransaction.create({
            user_id: req.user.id,
            amount,
            type: 'bonus', // Representing a top-up for now
            description: description || 'Wallet funds added'
        });

        res.status(200).json({
            success: true,
            message: 'Funds added successfully',
            balance: user.wallet_balance
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Withdraw money from wallet
// @route   POST /api/users/withdraw
// @access  Private
exports.withdrawMoney = async (req, res) => {
    try {
        const { amount, method } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        const user = await User.findById(req.user.id);
        if (user.wallet_balance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient balance' });
        }

        user.wallet_balance -= amount;
        await user.save();

        await PointTransaction.create({
            user_id: req.user.id,
            amount: -amount,
            type: 'withdrawal',
            description: `Withdrawal via ${method || 'Bank Transfer'}`
        });

        await Withdrawal.create({
            user: req.user.id,
            amount: amount,
            payment_method: method || 'Bank Transfer',
            payment_details: req.body.payment_details || {},
            status: 'pending'
        });

        res.status(200).json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            balance: user.wallet_balance
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get my disputes
// @route   GET /api/users/my-disputes
// @access  Private
exports.getMyDisputes = async (req, res) => {
    try {
        const userId = req.user.id;
        const disputes = await Dispute.find({
            $or: [{ buyer: userId }, { seller: userId }]
        }).populate('seller buyer', 'full_name profile_image');

        res.status(200).json({ success: true, data: disputes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get my invoices
// @route   GET /api/users/my-invoices
// @access  Private
exports.getMyInvoices = async (req, res) => {
    try {
        const userId = req.user.id;
        const invoices = await Invoice.find({ user: userId }).sort({ created_at: -1 });

        res.status(200).json({ success: true, data: invoices });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle save gig
// @route   POST /api/users/saved-gigs/:id
// @access  Private
exports.toggleSaveGig = async (req, res) => {
    try {
        const gigId = req.params.id;
        const userId = req.user.id;

        const existing = await SavedGig.findOne({ user: userId, gig: gigId });

        if (existing) {
            await SavedGig.deleteOne({ _id: existing._id });
            return res.json({ success: true, saved: false, message: 'Gig removed from saved' });
        } else {
            await SavedGig.create({ user: userId, gig: gigId });
            return res.json({ success: true, saved: true, message: 'Gig saved successfully' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get saved gigs
// @route   GET /api/users/saved-gigs
// @access  Private
exports.getSavedGigs = async (req, res) => {
    try {
        const userId = req.user.id;
        const saved = await SavedGig.find({ user: userId }).populate('gig');
        res.json({ success: true, data: saved });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle favorite project
// @route   PUT /api/users/favorites/:id
// @access  Private
exports.toggleFavoriteProject = async (req, res) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const index = user.favorites.indexOf(projectId);
        let isFavorited = false;

        if (index === -1) {
            user.favorites.push(projectId);
            isFavorited = true;
        } else {
            user.favorites.splice(index, 1);
            isFavorited = false;
        }

        await user.save();

        res.status(200).json({
            success: true,
            isFavorited,
            message: isFavorited ? 'Project added to favorites' : 'Project removed from favorites'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get favorite projects
// @route   GET /api/users/favorites
// @access  Private
exports.getFavoriteProjects = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate({
            path: 'favorites',
            populate: { path: 'client_id', select: 'full_name profile_image' }
        });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user.favorites });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle favorite startup idea
// @route   PUT /api/users/favorites-ideas/:id
// @access  Private
exports.toggleFavoriteIdea = async (req, res) => {
    try {
        const ideaId = req.params.id;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const index = user.favorite_ideas.indexOf(ideaId);
        let isFavorited = false;

        if (index === -1) {
            user.favorite_ideas.push(ideaId);
            isFavorited = true;
        } else {
            user.favorite_ideas.splice(index, 1);
            isFavorited = false;
        }

        await user.save();

        res.status(200).json({
            success: true,
            isFavorited,
            message: isFavorited ? 'Idea added to favorites' : 'Idea removed from favorites'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get favorite startup ideas
// @route   GET /api/users/favorites-ideas
// @access  Private
exports.getFavoriteIdeas = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate({
            path: 'favorite_ideas',
            populate: { path: 'creator', select: 'full_name profile_image' }
        });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user.favorite_ideas });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle favorite user (talent)
// @route   PUT /api/users/favorites-users/:id
// @access  Private
exports.toggleFavoriteUser = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const index = user.favorite_users.indexOf(targetUserId);
        let isFavorited = false;

        if (index === -1) {
            user.favorite_users.push(targetUserId);
            isFavorited = true;
        } else {
            user.favorite_users.splice(index, 1);
            isFavorited = false;
        }

        await user.save();

        res.status(200).json({
            success: true,
            isFavorited,
            message: isFavorited ? 'User added to bookmarks' : 'User removed from bookmarks'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get favorite users
// @route   GET /api/users/favorites-users
// @access  Private
exports.getFavoriteUsers = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate({
            path: 'favorite_users',
            select: 'full_name profile_image location role_title hourly_rate review_score review_count completed_projects skills',
            populate: { path: 'skills', select: 'name' }
        });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: user.favorite_users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
