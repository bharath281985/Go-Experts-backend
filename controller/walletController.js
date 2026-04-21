const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Withdrawal = require('../models/Withdrawal');
const SiteSettings = require('../models/SiteSettings');

// @desc    Get user wallet balance and transactions
// @route   GET /api/wallet/my-wallet
// @access  Private
exports.getMyWallet = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('wallet_balance referral_code full_name email phone_number');
        const transactions = await WalletTransaction.find({ user: req.user.id }).sort({ createdAt: -1 });
        const settings = await SiteSettings.findById('site_settings');

        res.status(200).json({
            success: true,
            balance: user.wallet_balance || 0,
            referral_code: user.referral_code,
            full_name: user.full_name,
            email: user.email,
            phone_number: user.phone_number,
            transactions,
            min_withdrawal: settings?.min_withdrawal_amount || 500,
            referral_reward: settings?.referral_reward_amount || 50
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Request a withdrawal
// @route   POST /api/wallet/withdraw
// @access  Private
exports.requestWithdrawal = async (req, res) => {
    try {
        const { amount, method, payment_details } = req.body;
        const user = await User.findById(req.user.id);
        const settings = await SiteSettings.findById('site_settings');
        const minAmount = settings?.min_withdrawal_amount || 500;

        if (amount < minAmount) {
            return res.status(400).json({ success: false, message: `Minimum withdrawal amount is ${minAmount}` });
        }

        if (user.wallet_balance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
        }

        // Create withdrawal request using existing model
        const withdrawal = await Withdrawal.create({
            user: req.user.id,
            amount,
            payment_method: method === 'bank_transfer' ? 'Bank Transfer' : 'UPI',
            payment_details,
            status: 'pending'
        });

        // Deduct from wallet immediately to "lock" the funds
        user.wallet_balance -= amount;
        await user.save();

        // Create transaction record for the debit
        await WalletTransaction.create({
            user: req.user.id,
            amount: -amount,
            type: 'withdrawal',
            status: 'pending',
            description: `Withdrawal request for ${amount}`,
            reference_id: withdrawal._id,
            balance_after: user.wallet_balance
        });

        res.status(201).json({
            success: true,
            message: 'Withdrawal request submitted successfully',
            withdrawal
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get user withdrawal history
// @route   GET /api/wallet/my-withdrawals
// @access  Private
exports.getMyWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, withdrawals });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
