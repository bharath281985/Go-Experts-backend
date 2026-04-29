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
            country_code,
            whatsapp_number,
            whatsapp_country_code
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
            phone_number: phone_number || whatsapp_number,
            country_code: country_code || whatsapp_country_code,
            whatsapp_number: whatsapp_number || phone_number,
            whatsapp_country_code: whatsapp_country_code || country_code,
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
        const verificationUrl = `${origin}/mobile-verify/${verificationToken}`;

        try {
            const trialMessageHtml = trialPlan ? `
                <div style="background-color: #fdf2f0; padding: 20px; border-radius: 12px; border: 1px solid #f24c20; margin: 25px 0;">
                    <h3 style="margin-top: 0; color: #f24c20; font-size: 18px;">🔥 Your ${trialPlan.duration_days}-Day Trial is Active!</h3>
                    <ul style="color: #444; font-size: 14px; padding-left: 20px; margin-bottom: 0;">
                        <li style="margin-bottom: 8px;">Post up to <b>${trialPlan.project_post_limit ?? 36}</b> Projects</li>
                        <li style="margin-bottom: 8px;">Direct Chat with <b>${trialPlan.chat_limit ?? 10}</b> Experts</li>
                        <li>Full Platform Access</li>
                    </ul>
                </div>` : `
                <p style="color: #555; font-size: 16px;">Your account has been created successfully. Welcome to the elite community of Go Experts.</p>`;

            await sendEmail({
                email: user.email,
                subject: trialPlan ? `Welcome to Go Experts! 🚀 ${trialPlan.duration_days} Days Trial Active` : 'Welcome to Go Experts',
                templateData: { name: user.full_name, link: verificationUrl },
                html: `
                    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0f0f0;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #1a1a1a; margin: 0; font-size: 28px; font-weight: 800;">Welcome, ${user.full_name}!</h1>
                            <p style="color: #f24c20; font-weight: 600; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px;">The Future of Freelancing</p>
                        </div>
                        
                        ${trialMessageHtml}
                        
                        <p style="color: #555; font-size: 15px; line-height: 1.6;">To unlock all features and start collaborating, please verify your email address by clicking the button below:</p>
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${verificationUrl}" style="background-color: #f24c20; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(242, 76, 32, 0.25);">Verify My Account</a>
                        </div>
                        
                        <p style="color: #999; font-size: 13px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; pt: 20px;">
                            If you didn't create this account, you can safely ignore this email.<br>
                            &copy; 2026 Go Experts Platform.
                        </p>
                    </div>
                `
            });
        } catch (err) {
            console.error('Welcome email failed:', err);
        }

        // Logic for subscription check
        const has_active_sub = !!(user.subscription_details && 
                                 user.subscription_details.plan_name && 
                                 (!user.subscription_details.end_date || new Date(user.subscription_details.end_date) > new Date()));

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.roles;
        delete userResponse.__v;

        res.status(201).json({
            success: true,
            token: generateToken(user._id),
            user: {
                ...userResponse,
                role: Array.isArray(user.roles) ? user.roles[0] : (user.role || 'user'),
                has_subscription: has_active_sub
            },
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
            const has_active_sub = !!(user.subscription_details && 
                                     user.subscription_details.plan_name && 
                                     (!user.subscription_details.end_date || new Date(user.subscription_details.end_date) > new Date()));

            const userResponse = user.toObject();
            delete userResponse.password;
            delete userResponse.roles; // Remove plural roles array
            delete userResponse.__v;   // Remove version key
            
            return res.status(403).json({
                success: false,
                message: 'Please verify your email address',
                token: generateToken(user._id),
                user: {
                    ...userResponse,
                    role: Array.isArray(user.roles) ? user.roles[0] : (user.role || 'user'),
                    has_subscription: has_active_sub,
                    phone_number: user.phone_number || '',
                    country_code: user.country_code || '',
                    whatsapp_number: user.whatsapp_number || '',
                    whatsapp_country_code: user.whatsapp_country_code || ''
                }
            });
        }

        const { latitude, longitude } = req.body;
        if (latitude && longitude) {
            user.latitude = latitude;
            user.longitude = longitude;
            await user.save();
        }

        const has_active_sub = !!(user.subscription_details && 
                                 user.subscription_details.plan_name && 
                                 (!user.subscription_details.end_date || new Date(user.subscription_details.end_date) > new Date()));

        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.roles; // Remove plural roles array
        delete userResponse.__v;   // Remove version key

        res.status(200).json({
            success: true,
            token: generateToken(user._id),
            user: {
                ...userResponse,
                role: Array.isArray(user.roles) ? user.roles[0] : (user.role || 'user'),
                has_subscription: has_active_sub
            }
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
        
        // Allowed to send OTP for existing users as well (e.g., for login or password reset)
        // if (userExists) {
        //    return res.status(400).json({ success: false, message: 'User already exists with this email' });
        // }

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
                templateData: { name: normalizedEmail.split('@')[0], link: `OTP: ${otp}`, otp: otp },
                message: `Your verification code is ${otp}. It will expire in 5 minutes.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #F24C20; text-align: center;">Email Verification Code</h1>
                        <p>Hi ${normalizedEmail.split('@')[0]},</p>
                        <p>Please use the following verification code to continue:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <span style="background-color: #Fdf2f0; color: #F24C20; padding: 12px 25px; border: 1px solid #F24C20; border-radius: 5px; font-weight: bold; font-size: 24px; display: inline-block; letter-spacing: 2px;">
                                ${otp}
                            </span>
                        </div>
                        <p style="font-size: 14px; color: #555; text-align: center;">This code will expire in 5 minutes.</p>
                        <p style="font-size: 12px; color: #777;">If you did not request this code, you can safely ignore this email.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Go Experts Security Team</p>
                    </div>
                `
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

        // Check if user already exists
        const user = await User.findOne({ email: normalizedEmail });
        const exists = !!user;

        await OTP.deleteOne({ _id: otpRecord._id });
        
        res.status(200).json({ 
            success: true, 
            message: 'Email verified successfully',
            exists: exists
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Forgot Password for mobile (via OTP)
 * @route   POST /api/mobile/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
    try {
        const OTP = require('../../models/OTP');
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide your email' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.status(404).json({ success: false, message: 'No account found with this email' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await OTP.findOneAndUpdate(
            { email: normalizedEmail },
            { otp, createdAt: Date.now() },
            { upsert: true, new: true }
        );

        await sendEmail({
            email: normalizedEmail,
            subject: 'Secure Password Reset Code',
            templateData: { name: user.full_name, otp: otp },
            html: `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0f0f0;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #1a1a1a; margin: 0; font-size: 24px; font-weight: 800;">Password Reset Request</h1>
                        <p style="color: #f24c20; font-weight: 600; margin-top: 5px; text-transform: uppercase;">Security Verification</p>
                    </div>
                    
                    <p style="color: #555; font-size: 15px; line-height: 1.6;">We received a request to reset your Go Experts password. Use the code below to complete the verification:</p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <div style="background-color: #fdf2f0; color: #f24c20; padding: 20px; border: 1px dashed #f24c20; border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 5px; display: inline-block;">
                            ${otp}
                        </div>
                    </div>
                    
                    <p style="color: #777; font-size: 13px; text-align: center;">This code will expire in 5 minutes for your security.</p>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px;">If you did not request this, please change your password immediately or contact support.</p>
                    </div>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Password reset code sent to email' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Reset Password for mobile
 * @route   POST /api/mobile/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
    try {
        const OTP = require('../../models/OTP');
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide email, OTP, and new password' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const otpRecord = await OTP.findOne({ email: normalizedEmail, otp });

        if (!otpRecord) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset code' });
        }

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.password = newPassword;
        await user.save();

        // Delete OTP after successful reset
        await OTP.deleteOne({ _id: otpRecord._id });

        // Post-reset success email
        await sendEmail({
            email: normalizedEmail,
            subject: 'Security Alert: Password Changed',
            templateData: { name: user.full_name },
            html: `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #ffffff; border-radius: 16px; border: 1px solid #f0f0f0;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="background-color: #ecfdf5; color: #10b981; width: 60px; hieght: 60px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
                            <span style="font-size: 30px;">✔</span>
                        </div>
                        <h1 style="color: #1a1a1a; margin: 0; font-size: 24px; font-weight: 800;">Password Updated</h1>
                    </div>
                    
                    <p style="color: #555; font-size: 15px; line-height: 1.6; text-align: center;">Your password has been successfully updated. You can now log in using your new credentials.</p>
                    
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                    
                    <p style="color: #999; font-size: 12px; text-align: center;">If you did not perform this action, please contact our security team immediately at <a href="mailto:support@goexperts.in" style="color: #f24c20;">support@goexperts.in</a>.</p>
                </div>
            `
        });

        res.status(200).json({ success: true, message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

