const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
const SiteSettings = require('../models/SiteSettings');
const WalletTransaction = require('../models/WalletTransaction');
const { generatePaymentHash, verifyResponseHash } = require('../utils/easebuzz');
const axios = require('axios');
const formData = require('form-data');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');

/**
 * @desc    Initiate Payment with Easebuzz
 * @route   POST /api/payment/initiate
 */
exports.initiatePayment = async (req, res) => {
    try {
        const { planId } = req.body;
        const user = await User.findById(req.user.id);
        const plan = await SubscriptionPlan.findById(planId);

        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        const txnid = `TXN${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
        const amount = plan.price.toFixed(2);
        
        // Easebuzz requires sanitized productinfo (alphanumeric and spaces preferred)
        const sanitizedProductInfo = (plan.name || 'Subscription').replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 100);
        const firstname = (user.full_name?.split(' ')[0] || 'User').replace(/[^a-zA-Z]/g, '').substring(0, 30);
        const phone = (user.phone_number || '9876543210').replace(/[^0-9]/g, '').substring(0, 10);
        
        const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;

        // Prepare data for hashing
        const paymentData = {
            txnid,
            amount,
            productinfo: sanitizedProductInfo,
            firstname,
            email: user.email,
            phone,
            surl: `${baseUrl}/api/payment/response`,
            furl: `${baseUrl}/api/payment/response`,
            udf1: planId.toString(),
            udf2: user._id.toString()
        };

        const key = process.env.EASEBUZZ_KEY;
        const salt = process.env.EASEBUZZ_SALT;
        const hash = generatePaymentHash(paymentData, salt, key);

        // Prep the raw POST payload for Easebuzz initiateLink
        const postData = new URLSearchParams();
        postData.append('key', key);
        postData.append('txnid', txnid);
        postData.append('amount', amount);
        postData.append('productinfo', sanitizedProductInfo);
        postData.append('firstname', firstname);
        postData.append('email', user.email);
        postData.append('phone', phone);
        postData.append('surl', paymentData.surl);
        postData.append('furl', paymentData.furl);
        postData.append('hash', hash);
        postData.append('udf1', paymentData.udf1);
        postData.append('udf2', paymentData.udf2);
        postData.append('udf3', '');
        postData.append('udf4', '');
        postData.append('udf5', '');
        postData.append('udf6', '');
        postData.append('udf7', '');
        postData.append('udf8', '');
        postData.append('udf9', '');
        postData.append('udf10', '');

        const initiateUrl = 'https://pay.easebuzz.in/payment/initiateLink';

        const ebResponse = await axios.post(initiateUrl, postData.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log('Easebuzz API Raw Response:', ebResponse.data);

        if (ebResponse.data.status === 1) {
             // Save transaction to DB
            await PaymentTransaction.create({
                user_id: user._id,
                plan_id: planId,
                payment_id: txnid, 
                txnid,
                amount: plan.price,
                status: 'initiated'
            });

            // The access_key is in ebResponse.data.data
            // Full checkout URL: base_url + access_key
            const baseUrl = 'https://pay.easebuzz.in/pay/';
            
            res.status(200).json({
                success: true,
                checkout_url: `${baseUrl}${ebResponse.data.data}`
            });
        } else {
            console.error('Easebuzz Init Error:', ebResponse.data);
            res.status(400).json({ 
                success: false, 
                message: ebResponse.data.error_desc || 'Easebuzz initiation failed' 
            });
        }

    } catch (err) {
        console.error('Initiate payment error:', err);
        res.status(500).json({ success: false, message: 'Payment initiation system error' });
    }
};

/**
 * @desc    Handle Easebuzz Response (Success or Failure)
 * @route   POST /api/payment/response
 */
exports.handlePaymentResponse = async (req, res) => {
    try {
        const data = req.body;
        console.log('Incoming Payment Response Body:', data);

        const key = process.env.EASEBUZZ_KEY;
        const salt = process.env.EASEBUZZ_SALT;

        // Verify Hash Integrity
        const isValid = verifyResponseHash(data, salt, key);
        console.log('Payment Hash Verification:', isValid ? 'SUCCESS' : 'FAILED');

        if (!isValid) {
            console.error('Hash Mismatch Details:', { received: data.hash, calculated: 'mismatch' });
            return res.status(400).send('Hash verification failed. The transaction might be incomplete or tampered.');
        }

        const transaction = await PaymentTransaction.findOne({ txnid: data.txnid });
        if (!transaction) {
            return res.status(404).send('Transaction not found');
        }

        // Update Transaction
        transaction.status = data.status === 'success' ? 'success' : 'failure';
        transaction.easebuzz_response = data;
        transaction.payment_method = data.mode;
        await transaction.save();

        if (data.status === 'success') {
            const plan = await SubscriptionPlan.findById(data.udf1);
            const user = await User.findById(data.udf2);

            if (plan && user) {
                // Activate/Renew Subscription
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(endDate.getDate() + plan.duration_days);

                const bonusPoints = plan.points_granted || 0;
                user.total_points = (user.total_points || 0) + bonusPoints;

                // Update or Create UserSubscription with all defined limits
                await UserSubscription.findOneAndUpdate(
                    { user_id: user._id },
                    {
                        plan_id: plan._id,
                        status: 'active',
                        start_date: startDate,
                        end_date: endDate,
                        remaining_project_posts: plan.project_post_limit,
                        remaining_task_posts: plan.task_post_limit,
                        remaining_chats: plan.chat_limit,
                        remaining_db_access: plan.database_access_limit,
                        remaining_interest_clicks: plan.interest_click_limit,
                        remaining_project_visits: plan.project_visit_limit,
                        remaining_portfolio_visits: plan.portfolio_visit_limit,
                        remaining_startup_posts: plan.startup_idea_post_limit || 0,
                        remaining_idea_unlocks: plan.startup_idea_explore_limit || 0,
                        reminder_sent_10d: false
                    },
                    { upsert: true, new: true }
                );

                // Sync main User model's summary and add bonus points
                user.subscription_details = {
                    plan_name: plan.name,
                    status: 'active',
                    start_date: startDate,
                    end_date: endDate,
                    project_credits: plan.project_visit_limit,
                    portfolio_credits: plan.portfolio_visit_limit,
                    task_credits: plan.task_post_limit,
                    chat_credits: plan.chat_limit,
                    db_credits: plan.database_access_limit
                };

                // Automatically grant roles associated with the plan if the user doesn't have them
                if (plan.target_role && plan.target_role.length > 0) {
                    plan.target_role.forEach(role => {
                        if (role !== 'both') {
                            if (!user.roles.includes(role)) {
                                user.roles.push(role);
                            }
                        } else {
                            // If role is 'both', add both client and freelancer
                            ['client', 'freelancer'].forEach(r => {
                                if (!user.roles.includes(r)) {
                                    user.roles.push(r);
                                }
                            });
                        }
                    });
                }
                
                await user.save();

                // ── Referral Reward on First Paid Subscription ───────────────────────
                if (user.referred_by && plan.price > 0) {
                    const previousPaidSubs = await PaymentTransaction.countDocuments({
                        user_id: user._id,
                        status: 'success',
                        _id: { $ne: transaction._id }
                    });

                    if (previousPaidSubs === 0) {
                        try {
                            const settings = await SiteSettings.findById('site_settings');
                            const reward = settings?.referral_reward_amount || 50;
                            const referrer = await User.findById(user.referred_by);

                            if (referrer) {
                                referrer.wallet_balance = (referrer.wallet_balance || 0) + reward;
                                await referrer.save();

                                await WalletTransaction.create({
                                    user: referrer._id,
                                    amount: reward,
                                    type: 'referral_reward',
                                    description: `Referral reward: ${user.full_name} bought ${plan.name}`,
                                    reference_id: user._id,
                                    balance_after: referrer.wallet_balance
                                });

                                // Notify referrer via email
                                sendEmail({
                                    email: referrer.email,
                                    subject: `You earned ₹${reward} – Referral Reward!`,
                                    html: `
                                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                            <h1 style="color: #F24C20; text-align: center;">🎉 Referral Reward!</h1>
                                            <p>Hi ${referrer.full_name},</p>
                                            <p>Great news! Your referral <strong>${user.full_name}</strong> just subscribed to the <strong>${plan.name}</strong> plan.</p>
                                            <div style="background: #fdf2f0; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
                                                <h2 style="color: #F24C20; margin: 0;">₹${reward} Added to Your Wallet!</h2>
                                            </div>
                                            <p>Your new wallet balance is ₹${referrer.wallet_balance}. Keep referring to earn more!</p>
                                        </div>
                                    `
                                }).catch(e => console.error('Referral reward email failed:', e));
                            }
                        } catch (refErr) {
                            console.error('Referral reward processing failed:', refErr);
                        }
                    }
                }

                // Send Confirmation Email
                try {
                    await sendEmail({
                        email: user.email,
                        subject: `Sucessfully Upgraded to ${plan.name} - Go Experts`,
                        html: `
                            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px;">
                                <div style="text-align: center; margin-bottom: 20px;">
                                    <h1 style="color: #F24C20; margin: 0;">Subscription Activated!</h1>
                                </div>
                                <p>Hi ${user.full_name},</p>
                                <p>Great news! Your upgrade to the <strong>${plan.name}</strong> has been processed successfully.</p>
                                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <p style="margin: 5px 0;"><strong>Plan:</strong> ${plan.name}</p>
                                    <p style="margin: 5px 0;"><strong>Valid Until:</strong> ${endDate.toLocaleDateString()}</p>
                                    <p style="margin: 5px 0;"><strong>Bonus Points Added:</strong> <span style="color: #F24C20; font-weight: bold;">+${bonusPoints} Experts Points</span></p>
                                </div>
                                <p>You can now access premium features including advanced specialist filters, direct interest clicks, and increased profile visit limits.</p>
                                <p style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: center; color: #888; font-size: 12px;">
                                    Thank you for using Go Experts!<br>
                                    Need help? Reach out to support@goexperts.in
                                </p>
                            </div>
                        `
                    });
                } catch (emailErr) {
                    console.error('Subscription email failed:', emailErr);
                }

                // ── Live Admin Notification & Email for Subscription ─────────────
                try {
                    const socketHandler = require('../utils/socket');
                    const io = socketHandler.getIo();
                    io.emit('admin_notification', {
                        type: 'NEW_SUBSCRIPTION',
                        title: 'New Paid Subscription',
                        message: `${user.full_name} subscribed to ${plan.name} (₹${plan.price})`,
                        timestamp: new Date(),
                        data: { userId: user._id, planName: plan.name, amount: plan.price }
                    });
                } catch(err) {
                    console.error('Socket admin subscription emit error:', err.message);
                }

                try {
                    const settings = await SiteSettings.findById('site_settings');
                    const adminEmail = settings?.admin_alert_email || process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
                    if (adminEmail) {
                        await sendEmail({
                            email: adminEmail,
                            subject: `💰 New Paid Subscription: ${plan.name} by ${user.full_name}`,
                            html: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                    <h2 style="color: #F24C20;">Subscription Purchase Alert</h2>
                                    <p>A user has successfully purchased a paid subscription plan.</p>
                                    <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                                        <p><strong>User:</strong> ${user.full_name} (${user.email})</p>
                                        <p><strong>Plan:</strong> ${plan.name}</p>
                                        <p><strong>Amount:</strong> ₹${plan.price}</p>
                                        <p><strong>Payment Method:</strong> Easebuzz</p>
                                        <p><strong>Transaction ID:</strong> ${data.txnid}</p>
                                    </div>
                                    <br/>
                                    <a href="https://go-experts.com/admin/users" style="background-color: #044071; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View User Details</a>
                                </div>
                            `
                        });
                    }
                } catch(adminEmailErr) {
                    console.error('Admin subscription notification email failed:', adminEmailErr);
                }
            }

            const frontendBase = process.env.FRONTEND_URL || 'https://goexperts.in';
            // Redirect to Success Page on Frontend
            res.redirect(`${frontendBase}/payment/success?txnid=${data.txnid}&plan=${plan?.name || ''}`);
        } else {
            const frontendBaseUrl = process.env.FRONTEND_URL || 'https://goexperts.in';
            // Redirect to Failure Page
            const msg = encodeURIComponent(data.error_Message || 'Payment failed at gateway');
            res.redirect(`${frontendBaseUrl}/payment/failure?txnid=${data.txnid}&msg=${msg}`);
        }

    } catch (err) {
        console.error('Payment response error:', err);
        res.status(500).send('An unexpected error occurred during payment processing.');
    }
};

/**
 * @desc    Pay for a subscription plan using wallet balance
 * @route   POST /api/payment/pay-with-wallet
 * @access  Private
 */
exports.payWithWallet = async (req, res) => {
    try {
        const { planId } = req.body;
        const user = await User.findById(req.user.id);
        const plan = await SubscriptionPlan.findById(planId);

        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
        if (plan.price <= 0) return res.status(400).json({ success: false, message: 'This plan is free — no payment needed' });
        if ((user.wallet_balance || 0) < plan.price) {
            return res.status(400).json({
                success: false,
                message: `Insufficient wallet balance. You need ₹${plan.price} but have ₹${user.wallet_balance || 0}.`
            });
        }

        // Deduct from wallet
        user.wallet_balance -= plan.price;

        // Activate subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration_days);
        const bonusPoints = plan.points_granted || 0;
        user.total_points = (user.total_points || 0) + bonusPoints;

        await UserSubscription.findOneAndUpdate(
            { user_id: user._id },
            {
                plan_id: plan._id,
                status: 'active',
                start_date: startDate,
                end_date: endDate,
                remaining_project_posts: plan.project_post_limit,
                remaining_task_posts: plan.task_post_limit,
                remaining_chats: plan.chat_limit,
                remaining_db_access: plan.database_access_limit,
                remaining_interest_clicks: plan.interest_click_limit,
                remaining_project_visits: plan.project_visit_limit,
                remaining_portfolio_visits: plan.portfolio_visit_limit,
                remaining_startup_posts: plan.startup_idea_post_limit || 0,
                remaining_idea_unlocks: plan.startup_idea_explore_limit || 0,
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
            project_credits: plan.project_visit_limit,
            portfolio_credits: plan.portfolio_visit_limit,
            task_credits: plan.task_post_limit,
            chat_credits: plan.chat_limit,
            db_credits: plan.database_access_limit
        };

        // Grant roles if applicable
        if (plan.target_role && plan.target_role.length > 0) {
            plan.target_role.forEach(role => {
                if (role === 'both') {
                    ['client', 'freelancer'].forEach(r => { if (!user.roles.includes(r)) user.roles.push(r); });
                } else if (!user.roles.includes(role)) {
                    user.roles.push(role);
                }
            });
        }

        await user.save();

        // Create transaction record
        const txnid = `WLT${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
        const transaction = await PaymentTransaction.create({
            user_id: user._id,
            plan_id: plan._id,
            payment_id: txnid,
            txnid,
            amount: plan.price,
            status: 'success',
            payment_method: 'wallet'
        });

        // Wallet debit entry
        await WalletTransaction.create({
            user: user._id,
            amount: -plan.price,
            type: 'subscription_payment',
            description: `Paid for ${plan.name} subscription`,
            reference_id: transaction._id,
            balance_after: user.wallet_balance
        });

        // Handle referral reward (same logic as Easebuzz payment)
        if (user.referred_by && plan.price > 0) {
            const previousPaidSubs = await PaymentTransaction.countDocuments({
                user_id: user._id,
                status: 'success',
                _id: { $ne: transaction._id }
            });
            if (previousPaidSubs === 0) {
                try {
                    const settings = await SiteSettings.findById('site_settings');
                    const reward = settings?.referral_reward_amount || 50;
                    const referrer = await User.findById(user.referred_by);
                    if (referrer) {
                        referrer.wallet_balance = (referrer.wallet_balance || 0) + reward;
                        await referrer.save();
                        await WalletTransaction.create({
                            user: referrer._id,
                            amount: reward,
                            type: 'referral_reward',
                            description: `Referral reward: ${user.full_name} bought ${plan.name}`,
                            reference_id: user._id,
                            balance_after: referrer.wallet_balance
                        });
                    }
                } catch (refErr) {
                    console.error('Wallet pay referral reward error:', refErr);
                }
            }
        }

        // Confirmation email
        try {
            await sendEmail({
                email: user.email,
                subject: `Subscription Activated via Wallet – ${plan.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
                        <h1 style="color: #F24C20; text-align: center;">Subscription Activated!</h1>
                        <p>Hi ${user.full_name},</p>
                        <p>₹${plan.price} was deducted from your Go Experts wallet to activate <strong>${plan.name}</strong>.</p>
                        <p><strong>Valid Until:</strong> ${endDate.toLocaleDateString('en-IN')}</p>
                        <p><strong>Remaining Wallet Balance:</strong> ₹${user.wallet_balance}</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Wallet subscription email error:', emailErr);
        }

        // ── Live Admin Notification & Email for Wallet Subscription ────────
        try {
            const socketHandler = require('../utils/socket');
            const io = socketHandler.getIo();
            io.emit('admin_notification', {
                type: 'NEW_SUBSCRIPTION',
                title: 'New Paid Subscription (Wallet)',
                message: `${user.full_name} subscribed to ${plan.name} (₹${plan.price})`,
                timestamp: new Date(),
                data: { userId: user._id, planName: plan.name, amount: plan.price }
            });
        } catch(err) {
            console.error('Socket admin wallet subscription emit error:', err.message);
        }

        try {
            const settings = await SiteSettings.findById('site_settings');
            const adminEmail = settings?.admin_alert_email || process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            if (adminEmail) {
                await sendEmail({
                    email: adminEmail,
                    subject: `💰 New Wallet Subscription: ${plan.name} by ${user.full_name}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #F24C20;">Subscription Purchase Alert (Wallet)</h2>
                            <p>A user has successfully purchased a paid subscription plan using their wallet balance.</p>
                            <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                                <p><strong>User:</strong> ${user.full_name} (${user.email})</p>
                                <p><strong>Plan:</strong> ${plan.name}</p>
                                <p><strong>Amount:</strong> ₹${plan.price}</p>
                                <p><strong>Payment Method:</strong> Wallet</p>
                                <p><strong>Transaction ID:</strong> ${txnid}</p>
                            </div>
                            <br/>
                            <a href="https://go-experts.com/admin/users" style="background-color: #044071; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View User Details</a>
                        </div>
                    `
                });
            }
        } catch(adminEmailErr) {
            console.error('Admin wallet subscription notification email failed:', adminEmailErr);
        }

        res.status(200).json({
            success: true,
            message: `₹${plan.price} deducted from wallet. ${plan.name} is now active!`,
            wallet_balance: user.wallet_balance
        });
    } catch (err) {
        console.error('Pay with wallet error:', err);
        res.status(500).json({ success: false, message: 'Wallet payment failed' });
    }
};
