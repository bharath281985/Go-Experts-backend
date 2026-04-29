const User = require('../models/User');
const Project = require('../models/Project');
const Dispute = require('../models/Dispute');
const Withdrawal = require('../models/Withdrawal');
const WalletTransaction = require('../models/WalletTransaction');
const Gig = require('../models/Gig');
const ContactMessage = require('../models/ContactMessage');
const StartupIdea = require('../models/StartupIdea');
const Meeting = require('../models/Meeting');
const InvestorOpportunity = require('../models/InvestorOpportunity');
const sendEmail = require('../utils/sendEmail');

const Skill = require('../models/Skill');
const Category = require('../models/Category');

// Allowed roles for role assignment
const VALID_ROLES = ['client', 'freelancer'];

// Helper to resolve name or ID to valid ObjectId
const resolveIds = async (Model, items) => {
    if (!items || !Array.isArray(items)) return [];
    const resolved = await Promise.all(items.map(async (item) => {
        // If it looks like a valid ObjectId, return it
        if (/^[0-9a-fA-F]{24}$/.test(item)) return item;
        // Otherwise, try to find by name
        const found = await Model.findOne({ name: new RegExp(`^${item}$`, 'i') });
        return found ? found._id : null;
    }));
    return resolved.filter(id => id !== null);
};

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeSellers = await User.countDocuments({ roles: 'freelancer' });
        const totalProjects = await Project.countDocuments();
        const totalGigs = await Gig.countDocuments();

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                activeSellers,
                totalProjects,
                totalGigs
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all users (excluding admins)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
        const search = (req.query.search || '').trim();
        const status = (req.query.status || 'all').trim();
        const role = (req.query.role || 'all').trim();
        const skip = (page - 1) * limit;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const baseQuery = { roles: { $ne: 'admin' } };

        if (search) {
            baseQuery.$or = [
                { full_name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        if (role !== 'all') {
            baseQuery.roles = role;
        }

        const statusQueryMap = {
            all: { is_deleted: { $ne: true } },
            new: { 
                created_at: { $gte: sevenDaysAgo },
                is_deleted: { $ne: true }
            },
            active: {
                is_suspended: { $ne: true },
                is_email_verified: true,
                is_deleted: { $ne: true }
            },
            kyc_not_verified: {
                kyc_status: { $nin: ['fully_verified', 'rejected'] },
                'kyc_details.is_verified': { $ne: true },
                is_deleted: { $ne: true }
            },
            suspended: { is_suspended: true, is_deleted: { $ne: true } },
            blocked: {
                $or: [
                    { is_suspended: true },
                    { is_blocked: true },
                    { status: 'blocked' },
                    { kyc_status: 'rejected' }
                ]
            },
            deleted: {
                $or: [
                    { is_deleted: true },
                    { deleted_at: { $exists: true, $ne: null } },
                    { status: 'deleted' }
                ]
            },
            paid: {
                $or: [
                    { 'subscription_details.plan_type': 'premium' },
                    { is_paid_user: true },
                    { total_paid_amount: { $gt: 0 } },
                    { 'subscription_details.plan_name': { $exists: true, $nin: [null, '', 'Starter Free Plan'] } }
                ],
                is_deleted: { $ne: true }
            }
        };

        const statusQuery = statusQueryMap[status] || statusQueryMap.all;
        const finalQuery = { ...baseQuery, ...statusQuery };

        const [users, totalUsers] = await Promise.all([
            User.find(finalQuery)
            .select('-password')
            .populate('skills', 'name')
            .populate('categories', 'name')
            .populate({ path: 'kyc', strictPopulate: false })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit),
            User.countDocuments(finalQuery)
        ]);

        const countQueryFromStatus = (statusKey) => User.countDocuments({
            ...baseQuery,
            ...(statusQueryMap[statusKey] || {})
        });

        const [
            allCount,
            newCount,
            activeCount,
            kycNotVerifiedCount,
            suspendedCount,
            blockedCount,
            deletedCount,
            paidCount
        ] = await Promise.all([
            User.countDocuments(baseQuery),
            countQueryFromStatus('new'),
            countQueryFromStatus('active'),
            countQueryFromStatus('kyc_not_verified'),
            countQueryFromStatus('suspended'),
            countQueryFromStatus('blocked'),
            countQueryFromStatus('deleted'),
            countQueryFromStatus('paid')
        ]);

        const summaryData = {
            all: allCount,
            new: newCount,
            active: activeCount,
            kyc_not_verified: kycNotVerifiedCount,
            suspended: suspendedCount,
            blocked: blockedCount,
            deleted: deletedCount,
            paid: paidCount
        };



        res.status(200).json({
            success: true,
            count: users.length,
            total: totalUsers,
            page,
            limit,
            totalPages: Math.ceil(totalUsers / limit),
            summary: summaryData,
            users
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new user
// @route   POST /api/admin/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, role, password, location, country, verified, status, hourlyRate, skills } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        // Resolve skills and categories from names/IDs
        const resolvedCategories = await resolveIds(Category, skills);
        const resolvedSkills = await resolveIds(Skill, skills);

        const user = await User.create({
            full_name: `${firstName} ${lastName}`,
            email,
            phone_number: phone,
            password, // Mongoose middleware will hash this

            roles: role === 'both' ? ['client', 'freelancer'] : [role],
            location: `${location}, ${country}`,
            is_email_verified: verified || false,
            is_suspended: status === 'suspended',
            // Specific fields
            hourly_rate: hourlyRate,
            categories: resolvedCategories,
            skills: resolvedSkills
        });

        res.status(201).json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('skills', 'name')
            .populate('categories', 'name')
            .populate({ path: 'kyc', strictPopulate: false });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const UserSubscription = require('../models/UserSubscription');
        const activeSub = await UserSubscription.findOne({ user_id: req.params.id, status: 'active' }).populate('plan_id');
        
        const userObj = user.toObject();
        userObj.active_subscription = activeSub;

        res.status(200).json({
            success: true,
            user: userObj
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update a user (full edit - name, email, phone, role, points, etc.)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
    try {
        const { 
            full_name, email, phone_number, roles, total_points, is_email_verified, is_suspended, location, bio,
            whatsapp_country_code, whatsapp_number, business_or_alternative_country_code, business_or_alternative_number,
            slug, meta_title, meta_keywords, meta_description, subscription_plan_id
        } = req.body;

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Prevent editing another admin
        if (user.roles.includes('admin')) {
            return res.status(403).json({ success: false, message: 'Cannot edit another admin account' });
        }

        // Validate roles if provided
        if (roles !== undefined) {
            if (!Array.isArray(roles) || roles.length === 0) {
                return res.status(400).json({ success: false, message: 'Roles must be a non-empty array' });
            }
            const invalidRoles = roles.filter(r => !VALID_ROLES.includes(r));
            if (invalidRoles.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid roles: ${invalidRoles.join(', ')}. Allowed: ${VALID_ROLES.join(', ')}`
                });
            }
            user.roles = roles;
        }

        // Validate email uniqueness if changed
        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email, _id: { $ne: req.params.id } });
            if (emailExists) {
                return res.status(400).json({ success: false, message: 'Email is already in use by another user' });
            }
            user.email = email;
        }

        // Validate points
        if (total_points !== undefined) {
            if (typeof total_points !== 'number' || total_points < 0) {
                return res.status(400).json({ success: false, message: 'Points must be a non-negative number' });
            }
            user.total_points = total_points;
        }

        // Apply rest of the fields
        if (full_name !== undefined) user.full_name = full_name.trim();
        if (phone_number !== undefined) user.phone_number = phone_number;
        if (is_email_verified !== undefined) user.is_email_verified = Boolean(is_email_verified);
        if (is_suspended !== undefined) user.is_suspended = Boolean(is_suspended);
        if (location !== undefined) user.location = location;
        if (bio !== undefined) user.bio = bio;

        // Apply Admin Edit User Profile Modal specific fields
        if (whatsapp_country_code !== undefined) user.whatsapp_country_code = whatsapp_country_code;
        if (whatsapp_number !== undefined) user.whatsapp_number = whatsapp_number;
        if (business_or_alternative_country_code !== undefined) user.business_or_alternative_country_code = business_or_alternative_country_code;
        if (business_or_alternative_number !== undefined) user.business_or_alternative_number = business_or_alternative_number;
        
        if (slug !== undefined) user.slug = slug;
        if (meta_title !== undefined) user.meta_title = meta_title;
        if (meta_keywords !== undefined) user.meta_keywords = meta_keywords;
        if (meta_description !== undefined) user.meta_description = meta_description;
        
        if (subscription_plan_id !== undefined) {
            // Note: If you want this to fully assign limits like trial assignment, you'd need logic here.
            // But simple assignment allows the profile to load.
            user.subscription_plan_id = subscription_plan_id;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            user
        });
    } catch (error) {
        console.error('updateUser error:', error);
        res.status(500).json({ success: false, message: 'Server error while updating user' });
    }
};

// @desc    Update only a user's roles
// @route   PUT /api/admin/users/:id/roles
// @access  Private/Admin
exports.updateUserRoles = async (req, res) => {
    try {
        const { roles } = req.body;

        if (!Array.isArray(roles) || roles.length === 0) {
            return res.status(400).json({ success: false, message: 'Roles must be a non-empty array' });
        }

        const invalidRoles = roles.filter(r => !VALID_ROLES.includes(r));
        if (invalidRoles.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid roles: ${invalidRoles.join(', ')}. Allowed: ${VALID_ROLES.join(', ')}`
            });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.roles.includes('admin')) {
            return res.status(403).json({ success: false, message: 'Cannot change admin account roles' });
        }

        user.roles = roles;
        await user.save();

        res.status(200).json({
            success: true,
            message: `Roles updated to: ${roles.join(', ')}`,
            user
        });
    } catch (error) {
        console.error('updateUserRoles error:', error);
        res.status(500).json({ success: false, message: 'Server error while updating roles' });
    }
};

// @desc    Get all projects
// @route   GET /api/admin/projects
// @access  Private/Admin
exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find({}).populate('client_id', 'full_name email').sort({ created_at: -1 });
        res.status(200).json({
            success: true,
            count: projects.length,
            projects
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle feature status of a project
// @route   PUT /api/admin/projects/:id/featured
// @access  Private/Admin
exports.toggleProjectFeatured = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        project.is_featured = !project.is_featured;
        await project.save();

        res.status(200).json({ success: true, data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update project status (Approve/Reject)
// @route   PUT /api/admin/projects/:id/status
// @access  Private/Admin
exports.updateProjectStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'live', 'closed', 'rejected', 'flagged'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const project = await Project.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        res.status(200).json({ success: true, message: `Project marked as ${status}`, data: project });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all gigs
// @route   GET /api/admin/gigs
// @access  Private/Admin
exports.getGigs = async (req, res) => {
    try {
        const gigs = await Gig.find({}).populate('freelancer_id', 'full_name profile_image email').sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: gigs.length,
            gigs
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all disputes
// @route   GET /api/admin/disputes
// @access  Private/Admin
exports.getDisputes = async (req, res) => {
    try {
        const disputes = await Dispute.find({})
            .populate('buyer', 'full_name email')
            .populate('seller', 'full_name email')
            .sort({ created_at: -1 });
        res.status(200).json({
            success: true,
            count: disputes.length,
            disputes
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update dispute status
// @route   PUT /api/admin/disputes/:id
// @access  Private/Admin
exports.updateDisputeStatus = async (req, res) => {
    try {
        const { status, resolution } = req.body;
        const dispute = await Dispute.findByIdAndUpdate(
            req.params.id,
            { status, resolution },
            { new: true, runValidators: true }
        );

        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Dispute not found' });
        }

        res.status(200).json({ success: true, data: dispute });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all contact messages
// @route   GET /api/admin/contact-messages
// @access  Private/Admin
exports.getContactMessages = async (req, res) => {
    try {
        const messages = await ContactMessage.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: messages.length, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete contact message
// @route   DELETE /api/admin/contact-messages/:id
// @access  Private/Admin
exports.deleteContactMessage = async (req, res) => {
    try {
        const message = await ContactMessage.findByIdAndDelete(req.params.id);
        if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
        res.status(200).json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all withdrawal requests
// @route   GET /api/admin/withdrawals
// @access  Private/Admin
exports.getWithdrawRequests = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({})
            .populate('user', 'full_name email wallet_balance')
            .sort({ created_at: -1 });
        res.status(200).json({
            success: true,
            count: withdrawals.length,
            withdrawals
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update withdrawal status
// @route   PUT /api/admin/withdrawals/:id
// @access  Private/Admin
exports.updateWithdrawStatus = async (req, res) => {
    try {
        const { status, admin_note } = req.body;
        const withdrawal = await Withdrawal.findById(req.params.id);

        if (!withdrawal) {
            return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
        }

        if (withdrawal.status !== 'pending' && status !== withdrawal.status) {
             return res.status(400).json({ success: false, message: 'Only pending requests can be changed' });
        }

        const updateData = { status };
        if (admin_note) updateData.admin_note = admin_note;
        
        if (status === 'approved' && withdrawal.status === 'pending') {
            updateData.processed_at = Date.now();
            
            // Mark transaction as completed if reference_id matches
            await WalletTransaction.findOneAndUpdate(
                { reference_id: withdrawal._id, type: 'withdrawal' },
                { $set: { status: 'completed' } }
            );
        }

        if (status === 'rejected' && withdrawal.status === 'pending') {
            // Refund the user
            const user = await User.findById(withdrawal.user);
            if (user) {
                user.wallet_balance += withdrawal.amount;
                await user.save();

                // Create refund transaction
                await WalletTransaction.create({
                    user: user._id,
                    amount: withdrawal.amount,
                    type: 'refund',
                    status: 'completed',
                    description: `Refund for rejected withdrawal request #${withdrawal._id.toString().slice(-6)}`,
                    reference_id: withdrawal._id,
                    balance_after: user.wallet_balance
                });

                // Mark original transaction as failed
                await WalletTransaction.findOneAndUpdate(
                    { reference_id: withdrawal._id, type: 'withdrawal' },
                    { $set: { status: 'failed' } }
                );
            }
        }

        const updatedWithdrawal = await Withdrawal.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true, runValidators: false }
        ).populate('user');

        res.status(200).json({ success: true, data: updatedWithdrawal });
    } catch (error) {
        console.error('updateWithdrawStatus error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Adjust user wallet balance manually
// @route   PUT /api/admin/users/:id/wallet
// @access  Private/Admin
exports.adjustUserWallet = async (req, res) => {
    try {
        const { amount, type, description } = req.body; // amount can be positive (add) or negative (subtract)
        
        if (amount === undefined || isNaN(amount)) {
            return res.status(400).json({ success: false, message: 'Valid amount is required' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.wallet_balance = (user.wallet_balance || 0) + Number(amount);
        await user.save();

        // Create transaction record
        await WalletTransaction.create({
            user: user._id,
            amount: Number(amount),
            type: type || (amount >= 0 ? 'bonus' : 'withdrawal'),
            status: 'completed',
            description: description || `Admin adjustment: ${amount >= 0 ? 'Added' : 'Subtracted'} ₹${Math.abs(amount)}`,
            balance_after: user.wallet_balance
        });

        // Send Email Notification
        try {
            const isAddition = Number(amount) >= 0;
            const actionText = isAddition ? 'Added to' : 'Deducted from';
            const statusColor = isAddition ? '#10b981' : '#ef4444';
            
            await sendEmail({
                email: user.email,
                subject: `Wallet Update: ₹${Math.abs(amount)} ${isAddition ? 'Credited' : 'Debited'}`,
                templateData: { name: user.full_name },
                message: `Hi ${user.full_name}, ₹${Math.abs(amount)} has been ${actionText} your Go Experts wallet. Your new balance is ₹${user.wallet_balance}.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: ${statusColor}; text-align: center;">Wallet Balance Updated</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>This is to inform you that an adjustment has been made to your <b>Go Experts Wallet</b> by the administrative team.</p>
                        
                        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                            <div style="font-size: 14px; color: #666; margin-bottom: 5px;">${isAddition ? 'Amount Credited' : 'Amount Debited'}</div>
                            <div style="font-size: 32px; font-bold: bold; color: ${statusColor};">₹${Math.abs(amount)}</div>
                        </div>

                        <div style="margin: 20px 0; border-top: 1px solid #eee; pt: 20px;">
                            <p><b>Transaction Details:</b></p>
                            <p style="color: #666; font-size: 14px;">${description || `Admin adjustment: ${amount >= 0 ? 'Added' : 'Subtracted'}`}</p>
                            <p><b>New Wallet Balance:</b> ₹${user.wallet_balance}</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://goexperts.in'}/dashboard" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Wallet</a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Go Experts Accounts Department</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Wallet adjustment email failed:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: `Wallet updated. New balance: ₹${user.wallet_balance}`,
            balance: user.wallet_balance
        });
    } catch (error) {
        console.error('adjustUserWallet error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update gig status
// @route   PUT /api/admin/gigs/:id/status
// @access  Private/Admin
exports.updateGigStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'live', 'closed', 'paused'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const gig = await Gig.findByIdAndUpdate(req.params.id, { status }, { new: true });

        if (!gig) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        res.status(200).json({
            success: true,
            message: `Gig status updated to ${status}`,
            gig
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete gig
// @route   DELETE /api/admin/gigs/:id
// @access  Private/Admin
exports.deleteGig = async (req, res) => {
    try {
        const gig = await Gig.findById(req.params.id);
        if (!gig) {
            return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        await Gig.deleteOne({ _id: req.params.id });

        res.status(200).json({
            success: true,
            message: 'Gig deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Startup Ideas Management ---

// @desc    Get all startup ideas
// @route   GET /api/admin/startup-ideas
// @access  Private/Admin
exports.getAdminStartupIdeas = async (req, res) => {
    try {
        const ideas = await StartupIdea.find()
            .populate('creator', 'full_name email')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: ideas.length, data: ideas });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update startup idea status (Approve/Reject)
// @route   PUT /api/admin/startup-ideas/:id/status
// @access  Private/Admin
exports.updateStartupIdeaStatus = async (req, res) => {
    try {
        const { status, internalNotes } = req.body;
        const validStatuses = ['pending', 'approved', 'rejected'];

        const updateData = {};
        if (status) {
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid status' });
            }
            updateData.status = status;
        }

        if (internalNotes !== undefined) {
            updateData.internalNotes = internalNotes;
        }

        const idea = await StartupIdea.findByIdAndUpdate(req.params.id, updateData, { new: true });

        if (!idea) {
            return res.status(404).json({ success: false, message: 'Idea not found' });
        }

        res.status(200).json({
            success: true,
            message: `Idea status updated to ${status}`,
            data: idea
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get detailed startup idea
// @route   GET /api/admin/startup-ideas/:id
// @access  Private/Admin
exports.getAdminStartupIdeaById = async (req, res) => {
    try {
        const idea = await StartupIdea.findById(req.params.id)
            .populate('creator', 'full_name email phone_number location profile_image');

        if (!idea) {
            return res.status(404).json({ success: false, message: 'Idea not found' });
        }

        res.status(200).json({
            success: true,
            data: idea
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Toggle feature status of a startup idea
// @route   PUT /api/admin/startup-ideas/:id/featured
// @access  Private/Admin
exports.toggleStartupIdeaFeatured = async (req, res) => {
    try {
        const idea = await StartupIdea.findById(req.params.id);
        if (!idea) return res.status(404).json({ success: false, message: 'Idea not found' });

        idea.isFeatured = !idea.isFeatured;
        await idea.save();

        res.status(200).json({ success: true, data: idea });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify user KYC
// @route   PUT /api/admin/users/:id/verify
// @access  Private/Admin
exports.verifyUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update both email and KYC verification
        user.is_email_verified = true;
        if (!user.kyc_details) user.kyc_details = {};
        user.kyc_details.is_verified = true;
        user.kyc_details.verified_at = Date.now();
        user.kyc_status = 'fully_verified';

        await user.save();

        // Also update associated KYC document if exists
        const KYC = require('../models/KYC');
        await KYC.findOneAndUpdate(
            { user: user._id },
            { 
                status: 'fully_verified',
                verified_at: Date.now()
            }
        );

        // Send Verification Email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Congratulations! Your Go Experts Profile is KYC Verified',
                templateData: { name: user.full_name },
                message: `Hi ${user.full_name}, your identity and professional documents have been successfully verified by our admin team! You are now a Verified Expert.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <img src="https://img.icons8.com/fluency/96/000000/verified-badge.png" width="80" alt="Verified" />
                        </div>
                        <h1 style="color: #F24C20; text-align: center;">Profile KYC Verified!</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>We are excited to inform you that your **KYC documents** on <b>Go Experts</b> have been reviewed and <b>successfully verified</b> by our administrative team!</p>
                        <p>You have now earned the **"Verified Expert"** badge. This will appear on your public profile and will significantly increase your credibility with potential clients.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://goexperts.in'}/settings" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Your Profile</a>
                        </div>
                        <p>Happy working!</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Sent via Go Experts Admin Panel</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Verification email failed:', emailErr);
        }

        res.status(200).json({ success: true, message: 'User KYC verified successfully and notification email sent.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Suspend/Activate user
// @route   PUT /api/admin/users/:id/suspend
// @access  Private/Admin
exports.suspendUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        // Toggle suspension status
        user.is_suspended = !user.is_suspended;
        
        // If activating, clear all other blocking flags to ensure they move to active
        if (!user.is_suspended) {
            user.is_blocked = false;
            user.blocked = false;
            if (user.status === 'blocked') {
                user.status = 'active';
            }
        }
        
        await user.save({ validateBeforeSave: false });
        const statusMessage = user.is_suspended ? 'User Blocked' : 'User Activated';

        // Send Email Notification
        try {
            const subject = user.is_suspended ? 'Your Go Experts Account has been Suspended' : 'Your Go Experts Account has been Reactivated';
            const bodyTitle = user.is_suspended ? 'Account Suspended' : 'Account Reactivated';
            const bodyText = user.is_suspended
                ? 'Your account has been suspended due to a violation of our terms of service or pending administrative review.'
                : 'Your account has been successfully reactivated. You can now login and continue using our services.';

            await sendEmail({
                email: user.email,
                subject: subject,
                templateData: { name: user.full_name },
                message: `Hi ${user.full_name}, ${bodyText}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: ${user.is_suspended ? '#ef4444' : '#10b981'}; text-align: center;">${bodyTitle}</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>${bodyText}</p>
                        ${!user.is_suspended ? `
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://goexperts.in'}/signin" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login Now</a>
                        </div>` : '<p>If you believe this is a mistake, please contact our support team.</p>'}
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Sent via Go Experts Admin Panel</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Suspension/Activation email failed:', emailErr);
        }

        res.status(200).json({ success: true, message: statusMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reject user profile
// @route   PUT /api/admin/users/:id/reject
// @access  Private/Admin
exports.rejectUser = async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await User.findById(req.params.id);
        // Update KYC status in database
        user.kyc_status = 'rejected';
        if (user.kyc_details) {
            user.kyc_details.is_verified = false;
        }
        await user.save({ validateBeforeSave: false });

        // Send Rejection Email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Go Experts Profile Review Update',
                templateData: { name: user.full_name, reason: reason || 'Information provided was insufficient or did not meet our guidelines.' },
                message: `Hi ${user.full_name}, your profile submission was not approved at this time. Reason: ${reason || 'Incomplete information'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #ef4444; text-align: center;">Profile Not Approved</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>Thank you for your interest in Go Experts. After reviewing your profile, we are unable to approve it at this time for the following reason:</p>
                        <blockquote style="background: #f9f9f9; border-left: 10px solid #ccc; margin: 1.5em 10px; padding: 0.5em 10px;">
                            ${reason || 'The information provided does not meet our community guidelines or is incomplete.'}
                        </blockquote>
                        <p>You can update your profile and resubmit it for review by logging into your account.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://goexperts.in'}/settings" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Update Profile</a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Sent via Go Experts Admin Panel</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Rejection email failed:', emailErr);
        }

        res.status(200).json({ success: true, message: 'User profile rejected and notification email sent.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Send profile completion reminder
// @route   POST /api/admin/users/:id/remind-complete
// @access  Private/Admin
exports.sendProfileCompletionReminder = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Send Reminder Email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Action Required: Complete Your Go Experts Profile',
                templateData: { name: user.full_name },
                message: `Hi ${user.full_name}, your profile is currently incomplete. Please login and finish setting up your account to start getting projects.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #F24C20; text-align: center;">Complete Your Profile</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>We noticed that your profile on <b>Go Experts</b> is missing some important information. A complete profile significantly increases your chances of getting hired or finding the right talent.</p>
                        <p>Please take a moment to add your bio, skills, and portfolio items.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://goexperts.in'}/settings" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Complete Profile Now</a>
                        </div>
                        <p>If you need any help, feel free to reply to this email.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">The Go Experts Onboarding Team</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Reminder email failed:', emailErr);
        }

        res.status(200).json({ success: true, message: 'Profile completion reminder sent.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Admin triggered password reset for user
// @route   POST /api/admin/users/:id/reset-password
// @access  Private/Admin
exports.resetUserPassword = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get reset token
        const resetToken = user.getResetPasswordToken();
        await user.save({ validateBeforeSave: false });

        // Create reset url
        const origin = process.env.FRONTEND_URL || 'https://goexperts.in';
        const resetUrl = `${origin}/reset-password/${resetToken}`;

        // Send Reset Email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Reset Your Go Experts Password (Admin Request)',
                templateData: { name: user.full_name, link: resetUrl },
                message: `Hi ${user.full_name}, an administrator has initiated a password reset for your Go Experts account. Click the link below to set a new password: \n\n ${resetUrl}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #F24C20; text-align: center;">Secure Password Reset</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>Our administration team has initiated a password reset for your account to ensure your security or assist with access.</p>
                        <p>Please click the button below to set a new password for your Go Experts account:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset My Password</a>
                        </div>
                        <p>This secure link will <b>expire in 1 hour</b>.</p>
                        <p style="font-size: 12px; color: #777;">If you did not expect this or have questions, please contact our support team immediately.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Go Experts Administration</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Admin password reset email failed:', emailErr);
            return res.status(500).json({ success: false, message: 'User found but reset email could not be sent. Check email configuration.' });
        }

        res.status(200).json({ success: true, message: 'Password reset link sent to user email.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.roles.includes('admin')) {
            return res.status(403).json({ success: false, message: 'Cannot delete an admin account' });
        }


        user.is_deleted = true;
        user.deleted_at = Date.now();
        await user.save({ validateBeforeSave: false });
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('deleteUser error:', error);
        res.status(500).json({ success: false, message: 'Server error while deleting user' });
    }
};

// @desc    Bulk user actions
// @route   POST /api/admin/users/bulk
// @access  Private/Admin
exports.bulkUserAction = async (req, res) => {
    try {
        const { userIds, action } = req.body;
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'User IDs must be a non-empty array' });
        }

        let result;
        switch (action) {
            case 'delete':
                const adminCheck = await User.find({ _id: { $in: userIds }, roles: 'admin' });
                if (adminCheck.length > 0) return res.status(403).json({ success: false, message: 'Cannot delete admin accounts' });
                result = await User.updateMany(
                    { _id: { $in: userIds } },
                    { 
                        is_deleted: true,
                        deleted_at: Date.now()
                    }
                );
                break;
            case 'verify':
                result = await User.updateMany({ _id: { $in: userIds } }, { is_email_verified: true });
                break;
            case 'suspend':
                result = await User.updateMany({ _id: { $in: userIds }, roles: { $ne: 'admin' } }, { is_suspended: true });
                break;
            case 'activate':
                result = await User.updateMany({ _id: { $in: userIds } }, { is_suspended: false });
                break;
            case 'seed_profile':
                // Bulk update dummy profile data for users (helpful for testing)
                result = await User.updateMany(
                    { _id: { $in: userIds }, roles: { $ne: 'admin' } },
                    {
                        location: 'New York, USA',
                        work_preference: 'remote',
                        experience_level: 'intermediate',
                        availability: 'fulltime',
                        budget_range: '15k-50k',
                        categories: ['webdev', 'uiux']
                    }
                );
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid action' });
        }

        res.status(200).json({
            success: true,
            message: `Bulk action '${action}' completed`,
            affectedCount: result.modifiedCount || result.deletedCount || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Send test email
// @route   POST /api/admin/test-email
// @access  Private/Admin
exports.sendTestEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Recipient email is required' });
        }

        await sendEmail({
            email,
            subject: 'Go Experts Test Email',
            message: 'This is a test email from the Go Experts Admin Panel to verify your SMTP settings.',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #F24C20; text-align: center;">SMTP Configuration Test</h1>
                    <p>Congratulations!</p>
                    <p>If you are reading this email, it means your SMTP settings for <b>Go Experts</b> are correctly configured and working properly.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 11px; color: #aaa; text-align: center;">Sent via Go Experts Admin Panel</p>
                </div>
            `
        });

        res.status(200).json({ success: true, message: `Test email sent to ${email}` });
    } catch (error) {
        console.error('sendTestEmail error:', error);
        res.status(500).json({ success: false, message: 'SMTP Error: ' + error.message });
    }
};

// @desc    Send direct custom email to user
// @route   POST /api/admin/users/:id/send-email
// @access  Private/Admin
exports.sendDirectEmail = async (req, res) => {
    try {
        const { subject, message, html } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!subject || !message) {
            return res.status(400).json({ success: false, message: 'Subject and message are required' });
        }

        await sendEmail({
            email: user.email,
            subject: subject,
            message: message,
            html: html || `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #044071;">Message from Go Experts Admin</h2>
                    <p>Hi ${user.full_name},</p>
                    <div style="padding: 15px; background: #f9f9f9; border-left: 4px solid #F24C20; margin: 20px 0; line-height: 1.6;">
                        ${message}
                    </div>
                    <p style="font-size: 11px; color: #aaa;">This is a direct message sent via the Go Experts Admin Panel.</p>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('sendDirectEmail error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all withdrawal requests
// @route   GET /api/admin/withdrawals
// @access  Private/Admin
exports.getWithdrawRequests = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find().populate('user', 'full_name email wallet_balance').sort({ created_at: -1 });
        res.status(200).json({ success: true, withdrawals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update withdrawal status
// @route   PUT /api/admin/withdrawals/:id
// @access  Private/Admin
exports.updateWithdrawStatus = async (req, res) => {
    try {
        const { status, admin_note } = req.body;
        const withdrawal = await Withdrawal.findById(req.params.id);

        if (!withdrawal) {
            return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
        }

        // If rejecting, refund the user
        if (status === 'rejected' && withdrawal.status !== 'rejected') {
            const user = await User.findById(withdrawal.user);
            if (user) {
                user.wallet_balance += withdrawal.amount;
                await user.save();

                // Track refund
                const PointTransaction = require('../models/PointTransaction');
                await PointTransaction.create({
                    user_id: user._id,
                    amount: withdrawal.amount,
                    type: 'refund',
                    description: `Refund for rejected withdrawal: ${admin_note || 'Rejected'}`
                });
            }
        }

        withdrawal.status = status;
        withdrawal.admin_note = admin_note;
        withdrawal.processed_at = Date.now();
        await withdrawal.save();

        res.status(200).json({ success: true, message: `Withdrawal status updated to ${status}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all disputes
// @route   GET /api/admin/disputes
// @access  Private/Admin
exports.getDisputes = async (req, res) => {
    try {
        const disputes = await Dispute.find()
            .populate('seller buyer', 'full_name profile_image')
            .sort({ created_at: -1 });
        res.status(200).json({ success: true, data: disputes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update dispute status
// @route   PUT /api/admin/disputes/:id
// @access  Private/Admin
exports.updateDisputeStatus = async (req, res) => {
    try {
        const { status, resolution } = req.body;
        const dispute = await Dispute.findByIdAndUpdate(
            req.params.id,
            { status, resolution, resolved_at: Date.now() },
            { new: true }
        );

        if (!dispute) {
            return res.status(404).json({ success: false, message: 'Dispute not found' });
        }

        res.status(200).json({ success: true, message: `Dispute status updated to ${status}`, dispute });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// --- Meetings Management ---

// @desc    Get all meetings
// @route   GET /api/admin/meetings
// @access  Private/Admin
exports.getAdminMeetings = async (req, res) => {
    try {
        const meetings = await Meeting.find()
            .populate('investor', 'full_name email')
            .populate('founder', 'full_name email')
            .populate('startup_idea', 'title')
            .sort({ meeting_date: -1 });
        res.status(200).json({ success: true, count: meetings.length, data: meetings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Investor Opportunities Management ---

// @desc    Get all investor opportunities
// @route   GET /api/admin/opportunities
// @access  Private/Admin
exports.getAdminOpportunities = async (req, res) => {
    try {
        const opportunities = await InvestorOpportunity.find()
            .populate('investor', 'full_name email')
            .populate('startup_idea', 'title')
            .sort({ updatedAt: -1 });
        res.status(200).json({ success: true, count: opportunities.length, data: opportunities });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
