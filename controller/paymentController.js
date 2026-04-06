const SubscriptionPlan = require('../models/SubscriptionPlan');
const UserSubscription = require('../models/UserSubscription');
const PaymentTransaction = require('../models/PaymentTransaction');
const User = require('../models/User');
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

        const initiateUrl = process.env.EASEBUZZ_ENV === 'prod' 
            ? 'https://pay.easebuzz.in/payment/initiateLink' 
            : 'https://testpay.easebuzz.in/payment/initiateLink';

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
            const baseUrl = process.env.EASEBUZZ_ENV === 'prod' 
                ? 'https://pay.easebuzz.in/pay/' 
                : 'https://testpay.easebuzz.in/pay/';
            
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

                // Send Confirmation Email
                try {
                    await sendEmail({
                        email: user.email,
                        subject: `Sucessfully Upgraded to ${plan.name} - Go Experts`,
                        templateTrigger: 'subscription_success', // Pre-configured template in DB
                        templateData: {
                            name: user.full_name,
                            plan: plan.name,
                            expiry: endDate.toLocaleDateString(),
                            points: bonusPoints.toString()
                        },
                        // Fallback text if template not found
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
