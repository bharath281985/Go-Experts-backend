const User = require('../models/User');
const UserSubscription = require('../models/UserSubscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PointTransaction = require('../models/PointTransaction');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');
const OTP = require('../models/OTP');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { full_name, email, password, roles, categories, skills, location, work_preference, experience_level, availability, budget_range, subscription_plan } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });
        if (user) {
            // Check if user already has any of the requested roles
            const requestedRoles = roles || ['freelancer'];
            const overlappingRoles = requestedRoles.filter(role => user.roles.includes(role));

            if (overlappingRoles.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `You are already registered as a ${overlappingRoles.join(' & ')}. Please login instead.`
                });
            }

            // If they don't have the role but the user exists, we could theoretically add the role here
            // but for now let's just block to keep it simple as per original logic.
            return res.status(400).json({ success: false, message: 'Email already exists. Please login.' });
        }

        // Create user
        const newUser = await User.create({
            full_name,
            email: normalizedEmail,
            password,
            roles: roles || ['freelancer'],
            categories,
            skills,
            location,
            work_preference,
            experience_level,
            availability,
            budget_range,
            total_points: subscription_plan ? 0 : 100, // Points will be granted by plan if selected
            is_email_verified: false, // Requires admin verification
            role: roles && roles.length > 0 ? roles[0] : 'freelancer'
        });

        // Assign 90-Day Free Trial Plan Automatically
        let trialPlan = await SubscriptionPlan.findOne({ name: '90-Day Free Trial' });

        if (!trialPlan) {
            trialPlan = await SubscriptionPlan.create({
                name: '90-Day Free Trial',
                price: 0,
                duration_days: 90,
                project_post_limit: 36,
                task_post_limit: 36,
                chat_limit: 10,
                database_access_limit: 5,
                project_visit_limit: 36,
                portfolio_visit_limit: 36,
                startup_idea_post_limit: 3,
                startup_idea_explore_limit: 3,
                features: [
                    "Full platform access for 90 days",
                    "Post up to 36 Projects",
                    "Post up to 36 Tasks",
                    "Direct chat with 10 people",
                    "36 Project Detail Visits",
                    "Email support from admin"
                ],
                target_role: 'both' // Applicable for all
            });
        }

        const trialDuration = trialPlan.duration_days || 90;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + trialDuration);

        await UserSubscription.create({
            user_id: newUser._id,
            plan_id: trialPlan._id,
            end_date: endDate,
            remaining_project_posts: trialPlan.project_post_limit,
            remaining_task_posts: trialPlan.task_post_limit,
            remaining_chats: trialPlan.chat_limit,
            remaining_db_access: trialPlan.database_access_limit,
            remaining_project_visits: trialPlan.project_visit_limit ?? 36,
            remaining_portfolio_visits: trialPlan.portfolio_visit_limit ?? 36,
            remaining_idea_unlocks: trialPlan.startup_idea_explore_limit ?? 3,
            remaining_startup_posts: trialPlan.startup_idea_post_limit ?? 3,
            status: 'active'
        });

        // Update user's subscription record summary
        newUser.subscription_details = {
            plan_name: trialPlan.name,
            end_date: endDate,
            status: 'active',
            project_credits: trialPlan.project_post_limit,
            task_credits: trialPlan.task_post_limit,
            chat_credits: trialPlan.chat_limit,
            db_credits: trialPlan.database_access_limit
        };
        await newUser.save();

        // Generate verification token
        const verificationToken = newUser.getEmailVerificationToken();
        await newUser.save({ validateBeforeSave: false });

        // Create verification url
        const origin = req.get('origin') || process.env.FRONTEND_URL || 'https://goexperts.in';
        const verificationUrl = `${origin}/verify-email/${verificationToken}`;

        // Send Welcome Email
        try {
            await sendEmail({
                email: newUser.email,
                subject: `Welcome to Go Experts - ${trialDuration} Days Free Trial Active!`,
                templateData: { name: newUser.full_name, link: verificationUrl },
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #F24C20; text-align: center;">Welcome to Go Experts!</h1>
                        <p>Hi ${newUser.full_name},</p>
                        <p>Congratulations! Your account has been created with a <b>${trialDuration}-Day Premium Free Trial</b>.</p>
                        <div style="background: #fdf2f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #F24C20;">Your Trial Benefits:</h3>
                            <ul style="margin-bottom: 0;">
                                <li>${trialDuration} Days Full Platform Access</li>
                                <li>Post up to ${trialPlan.project_post_limit ?? 36} Projects & Tasks</li>
                                <li>Direct Chat with ${trialPlan.chat_limit ?? 10} people</li>
                                <li>Access to Experts Library</li>
                            </ul>
                        </div>
                        <p>To get started, please verify your email address by clicking the button below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
                        </div>
                        <p style="font-size: 11px; color: #aaa; text-align: center;">After ${trialDuration} days, you can choose to upgrade your plan from your dashboard settings.</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Welcome email failed:', emailErr);
        }

        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json({
            success: true,
            token: generateToken(newUser._id),
            user: userResponse,
            message: 'Registration successful. Please check your email to verify your account.'
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify email address
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
    try {
        const crypto = require('crypto');
        // Get hashed token
        const emailVerificationToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            emailVerificationToken,
            emailVerificationExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification link. Please request a new one.'
            });
        }

        // Set email as verified
        user.is_email_verified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;

        await user.save({ validateBeforeSave: false });

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            success: true,
            token: generateToken(user._id),
            user: userResponse,
            message: 'Email verified successfully! You can now use all features of Go Experts.'
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Resend email verification link
// @route   POST /api/auth/resend-verification
// @access  Private (logged in but not verified)
exports.resendVerificationEmail = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.is_email_verified) {
            return res.status(400).json({ success: false, message: 'Email is already verified' });
        }

        // Generate new verification token
        const verificationToken = user.getEmailVerificationToken();
        await user.save({ validateBeforeSave: false });

        const origin = process.env.FRONTEND_URL || 'https://goexperts.in';
        const verificationUrl = `${origin}/verify-email/${verificationToken}`;

        await sendEmail({
            email: user.email,
            subject: 'Verify your Go Experts account',
            message: `Please verify your email: ${verificationUrl}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #F24C20; text-align: center;">Verify Your Email</h1>
                    <p>Hi ${user.full_name},</p>
                    <p>You requested a new verification link. Click the button below to verify your email:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${verificationUrl}" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
                    </div>
                    <p style="font-size: 12px; color: #777;">If the button above doesn't work, copy and paste this link: ${verificationUrl}</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 11px; color: #aaa; text-align: center;">This link will expire in 24 hours.</p>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Verification email resent successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'No details found, please sign up' });
        }

        if (!(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }

        if (!user.is_email_verified) {
            const userResponse = user.toObject();
            delete userResponse.password;
            return res.status(403).json({
                success: false,
                message: 'Please verify your email address to access your account.',
                token: generateToken(user._id), // return token so frontend can call resend-verification
                user: userResponse
            });
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({
            success: true,
            token: generateToken(user._id),
            user: userResponse
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Send OTP to email
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide an email' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists with this email
        const userExists = await User.findOne({ email: normalizedEmail });
        // NOTE: We might want to allow existing users to verify email for other purposes, 
        // but for signup, we block if they already exist.
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists with this email' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Log OTP for testing in dev mode
        console.log(`VERIFICATION OTP FOR ${email}: ${otp}`);

        // Save OTP to DB
        await OTP.findOneAndUpdate(
            { email: normalizedEmail },
            { otp, createdAt: Date.now() },
            { upsert: true, new: true }
        );

        // Send Email
        try {
            await sendEmail({
                email: normalizedEmail,
                subject: 'Your Go Experts Verification Code',
                templateTrigger: 'email_verification',
                templateData: { name: normalizedEmail.split('@')[0], link: `OTP: ${otp}` },
                message: `Your verification code is ${otp}. It will expire in 5 minutes.`,
                html: `<h1>Email Verification</h1><p>Your verification code is <b>${otp}</b>.</p><p>It will expire in 5 minutes.</p>`
            });
            res.status(200).json({ success: true, message: 'OTP sent successfully' });
        } catch (emailErr) {
            console.error('OTP email could not be sent:', emailErr);
            // In development, we still want to proceed even if email fails
            if (process.env.NODE_ENV === 'development') {
                return res.status(200).json({
                    success: true,
                    message: 'OTP logged to console (Dev Mode)',
                    dev_otp: otp // Only for debugging
                });
            }
            res.status(500).json({ success: false, message: 'Email could not be sent' });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Please provide email and OTP' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const otpRecord = await OTP.findOne({ email: normalizedEmail, otp });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        // OTP is valid, delete it
        await OTP.deleteOne({ _id: otpRecord._id });

        res.status(200).json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get reset token
        const resetToken = user.getResetPasswordToken();

        await user.save({ validateBeforeSave: false });

        // Create reset url
        // In local development we use localhost, in production it should be the domain
        const origin = req.get('origin') || process.env.FRONTEND_URL || 'https://goexperts.in';
        const resetUrl = `${origin}/reset-password/${resetToken}`;

        const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Reset Your Go Experts Password',
                templateData: { name: user.full_name, link: resetUrl },
                message: `Hi ${user.full_name}, someone requested a password reset for your Go Experts account. Click the link below to set a new password: \n\n ${resetUrl}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #F24C20; text-align: center;">Password Reset Request</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>You are receiving this email because we received a request to reset the password for your Go Experts account.</p>
                        <p>To create a new password, please click the button below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                        </div>
                        <p>This link will <b>expire in 10 minutes</b> for security reasons.</p>
                        <p style="font-size: 12px; color: #777;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Go Experts Security Team</p>
                    </div>
                `
            });

            res.status(200).json({ success: true, message: 'Password reset link sent to your email.' });
        } catch (error) {
            console.error('Forgot password email error:', error);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;

            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ success: false, message: 'Reset email could not be sent' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const crypto = require('crypto');
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.token)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Set password
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        // Send confirmation email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Successful',
                templateData: { name: user.full_name },
                message: `Hi ${user.full_name}, your password has been successfully reset. If you did not perform this action, please contact support immediately.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #10b981; text-align: center;">Password Reset Successful</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>This is a confirmation that the password for your Go Experts account has just been changed.</p>
                        <p>If you did not make this change, please contact our support team immediately to secure your account.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'https://goexperts.in'}/signin" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login to Your Account</a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">The Go Experts Security Team</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Password reset confirmation email failed:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Password reset successful',
            token: generateToken(user._id)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const identifier = req.params.id;
        
        let query = {};
        
        // If it's a valid ObjectId, search by _id, otherwise search by username
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            query._id = identifier;
        } else {
            query.username = identifier.toLowerCase();
        }

        const user = await User.findOne(query).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        // Auto-fix for users who uploaded docs but status is still unverified
        if (user.kyc_status === 'unverified' && (user.kyc_details?.pan_card || user.kyc_details?.aadhar_card)) {
            user.kyc_status = 'pending';
            await user.save();
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/update-profile
// @access  Private
// Update your backend updateProfile function to better handle file uploads
exports.updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Handle text fields
        const allowedFields = [
            'full_name', 'email', 'location', 'bio', 'phone_number',
            'availability', 'work_preference', 'experience_level', 'skills', 'hourly_rate',
            'categories', 'portfolio', 'experience_details', 'education_details', 'role_title', 'languages', 'completed_projects', 'happy_customers', 'review_score', 'kyc_details', 'documents', 'work_images', 'roles',
            'budget_range', 'landing_page_image', 'social_links'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                let value = req.body[field];

                // Safety check for roles - prevent adding admin
                if (field === 'roles' && Array.isArray(value)) {
                    value = value.filter(r => r !== 'admin');
                    if (value.length === 0) return;
                }

                // If it's a stringified JSON (from multipart/form-data), parse it
                if (typeof value === 'string' && (field === 'portfolio' || field === 'kyc_details' || field === 'documents' || field === 'work_images' || field === 'categories' || field === 'skills' || field === 'experience_details' || field === 'education_details' || field === 'languages' || field === 'social_links')) {
                    try {
                        const parsed = JSON.parse(value);
                        value = parsed;
                    } catch (e) {
                        // Keep as is if not JSON
                    }
                }

                // Merge nested objects instead of overwriting
                if ((field === 'kyc_details' || field === 'documents' || field === 'social_links') && typeof value === 'object' && value !== null) {
                    Object.keys(value).forEach(key => {
                        if (value[key] !== undefined) {
                            user.set(`${field}.${key}`, value[key]);
                        }
                    });
                    user.markModified(field);
                } else {
                    user[field] = value;
                }
            }
        });

        // Handle File Uploads
        if (req.files) {
            // Profile photo
            if (req.files.profile && req.files.profile[0]) {
                user.profile_image = `/uploads/profiles/${req.files.profile[0].filename}`;
            }

            // Landing Page Header image
            if (req.files.landing_image && req.files.landing_image[0]) {
                user.landing_page_image = `/uploads/profiles/${req.files.landing_image[0].filename}`;
            }

            // KYC documents
            if (req.files.pan_card && req.files.pan_card[0]) {
                user.set('kyc_details.pan_card', `/uploads/kyc/${req.files.pan_card[0].filename}`);
                user.markModified('kyc_details');
            }
            if (req.files.aadhar_card && req.files.aadhar_card[0]) {
                user.set('kyc_details.aadhar_card', `/uploads/kyc/${req.files.aadhar_card[0].filename}`);
                user.markModified('kyc_details');
            }

            // Educational documents - handle multiple files
            if (req.files.educational && req.files.educational.length > 0) {
                const newEdu = req.files.educational.map(file => `/uploads/documents/${file.filename}`);
                const currentEdu = user.documents?.educational || [];
                user.set('documents.educational', [...currentEdu, ...newEdu]);
                user.markModified('documents');
            }

            // Experience letter
            if (req.files.experience_letter && req.files.experience_letter[0]) {
                user.set('documents.experience_letter', `/uploads/documents/${req.files.experience_letter[0].filename}`);
                user.markModified('documents');
            }

            // Work images
            if (req.files.work_images && req.files.work_images.length > 0) {
                const newImages = req.files.work_images.map(file => `/uploads/portfolio/${file.filename}`);
                const currentImages = user.work_images || [];
                user.work_images = [...currentImages, ...newImages];
                user.markModified('work_images');
            }

            // Set kyc_status to pending if any KYC document is uploaded
            if (req.files.pan_card || req.files.aadhar_card || req.files.educational || req.files.experience_letter) {
                user.kyc_status = 'pending';
            }
        }

        // Clean up any corrupted existing data
        const mongoose = require('mongoose');
        if (Array.isArray(user.skills)) {
            user.skills = user.skills.filter(s => s && mongoose.Types.ObjectId.isValid(s.toString()));
        }
        if (Array.isArray(user.categories)) {
            user.categories = user.categories.filter(c => c && mongoose.Types.ObjectId.isValid(c.toString()));
        }

        await user.save();

        // Return the updated user without sensitive data
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.resetPasswordToken;
        delete userResponse.resetPasswordExpire;
        delete userResponse.emailVerificationToken;
        delete userResponse.emailVerificationExpire;

        res.status(200).json({
            success: true,
            user: userResponse,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating profile',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        if (!(await bcrypt.compare(req.body.current_password, user.password))) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = req.body.new_password;
        await user.save();

        // Send confirmation email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Your Password has been Changed',
                templateTrigger: 'password_change_success',
                templateData: { name: user.full_name },
                message: `Hi ${user.full_name}, your password has been successfully updated. If you did not perform this action, please contact support immediately.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #10b981; text-align: center;">Password Updated</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>Your password for Go Experts was recently changed. If this was you, you can safely ignore this email.</p>
                        <p><b>If you did not change your password</b>, please contact our support team immediately to protect your account.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5175'}/settings" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Security Settings</a>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">The Go Experts Security Team</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Password change confirmation email failed:', emailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const message = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: message[0] });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete user account
// @route   DELETE /api/auth/delete-account
// @access  Private
exports.deleteAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if admin is trying to delete themselves - usually allowed if there's at least one other admin or just allowed
        // But for safety, you might want to prevent deleting the last admin.

        await User.deleteOne({ _id: req.user.id });

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
