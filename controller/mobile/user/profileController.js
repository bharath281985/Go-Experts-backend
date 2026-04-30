const User = require('../../../models/User');
const bcrypt = require('bcryptjs');
const sendEmail = require('../../../utils/sendEmail');

/**
 * @desc    Get current user profile (Mobile Optimized)
 * @route   GET /api/mobile/user/me
 * @access  Private (Needs Token)
 */
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('-password -emailVerificationToken -passwordResetToken');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const has_subscription = !!(user.subscription_details && 
                                 user.subscription_details.plan_name && 
                                 (!user.subscription_details.end_date || new Date(user.subscription_details.end_date) > new Date()));

        const profileData = {
            id: user._id,
            full_name: user.full_name,
            email: user.email,
            role: Array.isArray(user.roles) ? user.roles[0] : (user.role || 'user'),
            avatar: user.avatar,
            headline: user.headline,
            bio: user.bio,
            location: user.location,
            wallet_balance: user.wallet_balance || 0,
            has_subscription: has_subscription,
            is_email_verified: user.is_email_verified,
            kyc_status: user.kyc_status || 'not_submitted',
            subscription_details: user.subscription_details || { plan_name: 'No Active Plan' },
            skills: user.skills || [],
            categories: user.categories || [],
            phone_number: user.phone_number || '',
            country_code: user.country_code || '',
            whatsapp_number: user.whatsapp_number || '',
            whatsapp_country_code: user.whatsapp_country_code || ''
        };

        res.status(200).json({ success: true, data: profileData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/mobile/user/update
 * @access  Private
 */
exports.updateProfile = async (req, res) => {
    try {
        const { 
            full_name, 
            bio, 
            headline, 
            location, 
            skills, 
            categories, 
            phone_number,
            country_code,
            whatsapp_number,
            whatsapp_country_code 
        } = req.body;

        const fieldsToUpdate = {};
        if (full_name) fieldsToUpdate.full_name = full_name;
        if (bio) fieldsToUpdate.bio = bio;
        if (headline) fieldsToUpdate.headline = headline;
        if (location) fieldsToUpdate.location = location;
        if (skills) fieldsToUpdate.skills = skills;
        if (categories) fieldsToUpdate.categories = categories;
        if (phone_number) fieldsToUpdate.phone_number = phone_number;
        if (country_code) fieldsToUpdate.country_code = country_code;
        if (whatsapp_number) fieldsToUpdate.whatsapp_number = whatsapp_number;
        if (whatsapp_country_code) fieldsToUpdate.whatsapp_country_code = whatsapp_country_code;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { $set: fieldsToUpdate },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({ 
            success: true, 
            message: 'Profile updated successfully',
            data: updatedUser 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Change Password (Internal Profile)
 * @route   POST /api/mobile/user/change-password
 * @access  Private
 */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new password' });
        }

        const user = await User.findById(req.user.id).select('+password');

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }

        user.password = newPassword;
        await user.save();

        try {
            await sendEmail({
                email: user.email,
                subject: 'Security Alert: Password Changed',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #F24C20; text-align: center;">Password Changed Successfully</h2>
                        <p>Hi ${user.full_name},</p>
                        <p>This is a confirmation that the password for your Go Experts account has been successfully changed.</p>
                        <p>If you did not perform this action, please contact our support team immediately.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #aaa; text-align: center;">Go Experts Security Team</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Change password alert failed:', emailErr);
        }

        res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
