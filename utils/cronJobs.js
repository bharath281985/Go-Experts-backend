const cron = require('node-cron');
const User = require('../models/User');
const PointTransaction = require('../models/PointTransaction');

const dailyPointsExpiry = () => {
    // Run everyday at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily maintenance tasks...');
        const UserSubscription = require('../models/UserSubscription');
        const sendEmail = require('./sendEmail');

        try {
            // Task 1: Daily Points Deduction (Existing logic)
            const users = await User.find({ total_points: { $gt: 0 } });
            for (let user of users) {
                user.total_points -= 1;
                await user.save();
                await PointTransaction.create({
                    user_id: user._id, amount: -1, type: 'daily_expiry',
                    description: 'Daily point deduction'
                });
            }

            // Task 2: Multi-Stage Notifications & Grace Period Expiry Tasks
            const now = new Date();
            const graceExpiryDate = new Date();
            graceExpiryDate.setDate(graceExpiryDate.getDate() - 2); // 2 days past

            const subList = await UserSubscription.find({
                status: 'active'
            }).populate('user_id');

            for (const sub of subList) {
                if (!sub.user_id) continue;
                const user = sub.user_id;
                
                // A. Grace Period Expiry Check
                if (sub.end_date <= graceExpiryDate) {
                    sub.status = 'expired';
                    await sub.save();

                    if (!sub.reminder_sent_exp) {
                        await sendEmail({
                            email: user.email,
                            subject: '🚨 GoExperts Alert: Subscription Expired!',
                            message: 'Your plan has officially ended and your 2-day grace period is over.',
                            html: `
                                <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 15px;">
                                    <h2 style="color: #F24C20;">Access Revoked!</h2>
                                    <p>Hi ${user.full_name},</p>
                                    <p>Your subscription has officially ended. </p>
                                    <p>To restore your access and continue using your credits, please upgrade now.</p>
                                    <div style="margin: 30px 0; text-align: center;">
                                        <a href="${process.env.FRONTEND_URL}/subscription" style="background: #F24C20; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Re-activate Now</a>
                                    </div>
                                </div>
                            `
                        });
                        sub.reminder_sent_exp = true;
                        await sub.save();
                    }
                    continue; 
                }

                // B. Notifications for Active Subs
                const diffDays = Math.ceil((sub.end_date - now) / (1000 * 60 * 60 * 24));
                const renewalLink = `${process.env.FRONTEND_URL || 'https://goexperts.in'}/dashboard/subscription`;
                const expiryDate = sub.end_date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

                // 10-Day Reminder
                if (diffDays <= 10 && diffDays > 3 && !sub.reminder_sent_10d) {
                    await sendEmail({
                        email: user.email,
                        subject: '⏳ Your Go Experts subscription expires in 10 days',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
                                <h1 style="color: #F24C20; text-align: center;">Subscription Expiring Soon</h1>
                                <p>Hi ${user.full_name},</p>
                                <p>Your Go Experts subscription will expire in <strong>${diffDays} days</strong> on <strong>${expiryDate}</strong>.</p>
                                <p>Renew now to avoid any interruption to your premium access and active credits.</p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${renewalLink}" style="background-color: #F24C20; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Renew My Subscription</a>
                                </div>
                                <p style="font-size: 12px; color: #888; text-align: center;">Need help? Contact support@goexperts.in</p>
                            </div>
                        `
                    });
                    sub.reminder_sent_10d = true;
                    await sub.save();
                }

                // 3-Day Reminder
                if (diffDays <= 3 && diffDays > 0 && !sub.reminder_sent_3d) {
                    await sendEmail({
                        email: user.email,
                        subject: '🚨 Final reminder: Your subscription expires in 3 days!',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
                                <h1 style="color: #e74c3c; text-align: center;">Only ${diffDays} Day${diffDays > 1 ? 's' : ''} Left!</h1>
                                <p>Hi ${user.full_name},</p>
                                <p>This is your final reminder — your Go Experts subscription expires in just <strong>${diffDays} day${diffDays > 1 ? 's' : ''}</strong> on <strong>${expiryDate}</strong>.</p>
                                <p>After expiry, you will lose access to premium features and your remaining credits. Renew now to stay uninterrupted!</p>
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${renewalLink}" style="background-color: #F24C20; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Renew Now — Don't Lose Access</a>
                                </div>
                                <p style="font-size: 12px; color: #888; text-align: center;">Need help? Contact support@goexperts.in</p>
                            </div>
                        `
                    });
                    sub.reminder_sent_3d = true;
                    await sub.save();
                }
            }

            console.log('Daily maintenance tasks completed');
        } catch (err) {
            console.error('Error in maintenance tasks:', err);
        }
    });
};

module.exports = dailyPointsExpiry;
