const User = require('../../models/User');
const UserSubscription = require('../../models/UserSubscription');
const SubscriptionPlan = require('../../models/SubscriptionPlan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sendEmail = require('../../utils/sendEmail');
const SiteSettings = require('../../models/SiteSettings');
const WalletTransaction = require('../../models/WalletTransaction');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

/**
 * @desc    Register a new mobile user
 * @route   POST /api/mobile/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
    try {
        const { 
            full_name, 
            email, 
            password, 
            role, // Expecting a single role from mobile usually
            roles, // Fallback to array if provided
            categories, 
            skills, 
            location, 
            latitude,
            longitude,
            phone_number,
            country_code
        } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        
        // Handle role logic - mobile might send 'role' or 'roles'
        let finalRoles = ['freelancer'];
        if (role) {
            finalRoles = [role];
        } else if (Array.isArray(roles) && roles.length > 0) {
            finalRoles = roles;
        }
        
        const primaryRole = finalRoles[0];

        // Check if user exists
        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'Email already exists. Please login.' });
        }

        // Handle referral code if provided
        let referredBy = null;
        if (req.body.referral_code) {
            const referrer = await User.findOne({ referral_code: req.body.referral_code.toUpperCase() });
            if (referrer) {
                referredBy = referrer._id;
            }
        }

        // Create user
        const user = await User.create({
            full_name,
            email: normalizedEmail,
            password,
            roles: finalRoles,
            role: primaryRole,
            categories,
            skills,
            location,
            latitude,
            longitude,
            phone_number,
            country_code,
            referred_by: referredBy,
            is_email_verified: false,
            total_points: 100
        });

        // Referral is tracked here, but reward is credited only after the referred user
        // buys their first paid subscription (not on signup / free trial).

        // Dynamic Free Trial Assignment (logic copied from existing controller to maintain consistency)
        let trialPlan = await SubscriptionPlan.findOne({
            price: 0,
            status: 'enabled',
            target_role: primaryRole,
            group: 'Free Trial Plan'
        }).sort({ updatedAt: -1 });

        if (!trialPlan) {
            trialPlan = await SubscriptionPlan.findOne({
                price: 0,
                status: 'enabled',
                target_role: primaryRole
            }).sort({ updatedAt: -1 });
        }

        if (trialPlan) {
            const trialDuration = trialPlan.duration_days || 0;
            const endDate = new Date();
            if (trialDuration > 0) endDate.setDate(endDate.getDate() + trialDuration);

            await UserSubscription.create({
                user_id: user._id,
                plan_id: trialPlan._id,
                end_date: endDate,
                remaining_project_posts:    Number(trialPlan.project_post_limit          || 0),
                remaining_task_posts:       Number(trialPlan.task_post_limit             || 0),
                remaining_chats:            Number(trialPlan.chat_limit                  || 0),
                remaining_db_access:        Number(trialPlan.database_access_limit       || 0),
                remaining_project_visits:   Number(trialPlan.project_visit_limit         || 0),
                remaining_portfolio_visits: Number(trialPlan.portfolio_visit_limit       || 0),
                remaining_idea_unlocks:     Number(trialPlan.startup_idea_explore_limit  || 0),
                remaining_startup_posts:    Number(trialPlan.startup_idea_post_limit     || 0),
                remaining_interest_clicks:  Number(trialPlan.interest_click_limit        || 0),
                total_project_posts:        Number(trialPlan.project_post_limit          || 0),
                total_task_posts:           Number(trialPlan.task_post_limit             || 0),
                total_chats:                Number(trialPlan.chat_limit                  || 0),
                total_db_access:            Number(trialPlan.database_access_limit       || 0),
                total_project_visits:       Number(trialPlan.project_visit_limit         || 0),
                total_portfolio_visits:     Number(trialPlan.portfolio_visit_limit       || 0),
                total_idea_unlocks:         Number(trialPlan.startup_idea_explore_limit  || 0),
                total_startup_posts:        Number(trialPlan.startup_idea_post_limit     || 0),
                total_interest_clicks:      Number(trialPlan.interest_click_limit        || 0),
                status: 'active'
            });

            user.subscription_details = {
                plan_name: trialPlan.name,
                end_date: endDate,
                plan_type: 'trial'
            };
            await user.save();
        }

        // Email Verification
        const verificationToken = user.getEmailVerificationToken();
        await user.save({ validateBeforeSave: false });

        const origin = process.env.FRONTEND_URL || 'https://goexperts.in';
        const verificationUrl = `${origin}/verify-email/${verificationToken}`;

        try {
            const trialMessageHtml = trialPlan ? `
                        <p>Congratulations! Your account has been created with a <b>${trialPlan.duration_days}-Day Premium Free Trial</b>.</p>
                        <div style="background: #fdf2f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #F24C20;">Your Trial Benefits:</h3>
                            <ul style="margin-bottom: 0;">
                                <li>${trialPlan.duration_days} Days Full Platform Access</li>
                                <li>Post up to ${trialPlan.project_post_limit ?? 36} Projects & Tasks</li>
                                <li>Direct Chat with ${trialPlan.chat_limit ?? 10} people</li>
                                <li>Access to Experts Library</li>
                            </ul>
                        </div>` : `
                        <p>Your account has been created successfully. Please verify your email to continue.</p>`;

            await sendEmail({
                email: user.email,
                subject: trialPlan ? `Welcome to Go Experts - ${trialPlan.duration_days} Days Free Trial Active!` : 'Welcome to Go Experts',
                templateData: { name: user.full_name, link: verificationUrl },
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #F24C20; text-align: center;">Welcome to Go Experts!</h1>
                        <p>Hi ${user.full_name},</p>
                        ${trialMessageHtml}
                        <p>To get started, please verify your email address by clicking the button below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" style="background-color: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
                        </div>
                        ${trialPlan ? `<p style="font-size: 11px; color: #aaa; text-align: center;">After ${trialPlan.duration_days} days, you can choose to upgrade your plan from your dashboard settings.</p>` : ''}
                    </div>
                `
            });
        } catch (err) {
            console.error('Welcome email failed:', err);
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            success: true,
            token: generateToken(user._id),
            user: userResponse,
            message: 'Registration successful. Please verify your email.'
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Login mobile user
 * @route   POST /api/mobile/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail }).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with this email' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.is_email_verified) {
            const userResponse = user.toObject();
            delete userResponse.password;
            return res.status(403).json({
                success: false,
                message: 'Please verify your email address',
                token: generateToken(user._id),
                user: userResponse
            });
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        // Optionally update location on login if coordinates provided
        const { latitude, longitude } = req.body;
        if (latitude && longitude) {
            user.latitude = latitude;
            user.longitude = longitude;
            await user.save();
            userResponse.latitude = latitude;
            userResponse.longitude = longitude;
        }

        res.status(200).json({
            success: true,
            token: generateToken(user._id),
            user: userResponse
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Send OTP to email for mobile
 * @route   POST /api/mobile/auth/send-otp
 */
exports.sendOTP = async (req, res) => {
    try {
        const OTP = require('../../models/OTP');
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide an email' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const userExists = await User.findOne({ email: normalizedEmail });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists with this email' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate(
            { email: normalizedEmail },
            { otp, createdAt: Date.now() },
            { upsert: true, new: true }
        );

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
            res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Verify OTP for mobile
 * @route   POST /api/mobile/auth/verify-otp
 */
exports.verifyOTP = async (req, res) => {
    try {
        const OTP = require('../../models/OTP');
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Please provide email and OTP' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const otpRecord = await OTP.findOne({ email: normalizedEmail, otp });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        await OTP.deleteOne({ _id: otpRecord._id });
        res.status(200).json({ success: true, message: 'Email verified successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
