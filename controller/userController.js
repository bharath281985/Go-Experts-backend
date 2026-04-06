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

// @desc    Get all freelancers
// @route   GET /api/users/freelancers
// @access  Public
exports.getFreelancers = async (req, res) => {
    try {
        const { categories, skills, role, search } = req.query;
        let query = { roles: 'freelancer' };

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

        // Validation Guard: Check if ID is valid and not 'undefined'
        if (!talentId || talentId === 'undefined' || !mongoose.Types.ObjectId.isValid(talentId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid freelancer ID format' 
            });
        }

        const freelancer = await User.findOne({ _id: talentId, roles: 'freelancer' })
            .select('-password')
            .populate('categories', 'name')
            .populate('skills', 'name');
        if (!freelancer) {
            return res.status(404).json({ success: false, message: 'Freelancer not found' });
        }
        res.json({ success: true, data: freelancer });
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
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const stats = {
            roles: user.roles,
            wallet_balance: user.wallet_balance || 0,
            total_points: user.total_points || 0
        };

        // Client stats
        if (user.roles.includes('client')) {
            const projects = await Project.find({ client_id: userId });
            const ordersAsBuyer = await GigOrder.find({ buyer_id: userId });

            stats.client = {
                total_projects: projects.length,
                live_projects: projects.filter(p => p.status === 'live').length,
                total_spent: ordersAsBuyer
                    .filter(o => o.payment_status === 'paid')
                    .reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
                ongoing_gig_orders: ordersAsBuyer.filter(o => ['pending', 'in_progress', 'delivered'].includes(o.status)).length
            };
        }

        // Freelancer stats
        if (user.roles.includes('freelancer')) {
            const gigs = await Gig.find({ freelancer_id: userId });
            const ordersAsSeller = await GigOrder.find({ seller_id: userId })
                .populate('gig_id', 'title')
                .populate('buyer_id', 'full_name')
                .sort({ createdAt: -1 });
            
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
                completed_projects: ordersAsSeller.filter(o => o.status === 'completed').length,
                total_earnings: ordersAsSeller
                    .filter(o => o.status === 'completed' || o.payment_status === 'paid')
                    .reduce((acc, curr) => acc + (curr.price || 0), 0),
                current_month_earnings: currentMonthEarnings,
                earnings_trend: earningsTrend,
                pending_payouts: ordersAsSeller
                    .filter(o => ['in_progress', 'delivered'].includes(o.status) && o.payment_status === 'paid')
                    .reduce((acc, curr) => acc + (curr.price || 0), 0),
                pipeline: {
                    in_progress: ordersAsSeller.filter(o => o.status === 'in_progress').length,
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
                performance: {
                    completion_rate: 95, // Mocking these complex calcs for now until review model exists
                    on_time_delivery: 98,
                    satisfaction: 4.9
                }
            };
        }

        // Subscription info
        const subscription = await UserSubscription.findOne({ user_id: userId, status: 'active' }).populate('plan_id');
        stats.subscription = subscription ? {
            plan_name: subscription.plan_id.name,
            start_date: subscription.start_date,
            end_date: subscription.end_date,
            
            // Usage stats
            remaining_project_posts: subscription.remaining_project_posts,
            total_project_posts: subscription.plan_id.project_post_limit,
            
            remaining_interest_clicks: subscription.remaining_interest_clicks,
            total_interest_clicks: subscription.plan_id.interest_click_limit,
            
            remaining_project_visits: subscription.remaining_project_visits,
            total_project_visits: subscription.plan_id.project_visit_limit,
            
            remaining_portfolio_visits: subscription.remaining_portfolio_visits,
            total_portfolio_visits: subscription.plan_id.portfolio_visit_limit,

            status: subscription.status
        } : null;

        res.status(200).json({
            success: true,
            data: stats
        });
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
