const User = require('../../../models/User');
const WalletTransaction = require('../../../models/WalletTransaction');
const Withdrawal = require('../../../models/Withdrawal');
const SiteSettings = require('../../../models/SiteSettings');

/**
 * @desc    Get user wallet balance and transactions
 * @route   GET /api/mobile/user/wallet
 * @route   GET /api/mobile/user/my-wallet
 * @access  Private
 */
exports.getMyWallet = async (req, res) => {
    try {
        const [user, transactions, settings] = await Promise.all([
            User.findById(req.user.id).select('wallet_balance referral_code full_name email phone_number'),
            WalletTransaction.find({ user: req.user.id }).sort({ createdAt: -1 }),
            SiteSettings.findById('site_settings')
        ]);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please log in again.' });
        }

        res.status(200).json({
            success: true,
            message: 'Wallet details fetched successfully.',
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

/**
 * @desc    Request a withdrawal
 * @route   POST /api/mobile/user/withdraw
 * @access  Private
 */
exports.requestWithdrawal = async (req, res) => {
    try {
        const { amount, method, payment_details } = req.body;
        const withdrawalAmount = Number(amount);

        if (!withdrawalAmount || withdrawalAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide a valid withdrawal amount.' });
        }

        if (!method) {
            return res.status(400).json({ success: false, message: 'Please provide a withdrawal method.' });
        }

        const [user, settings] = await Promise.all([
            User.findById(req.user.id),
            SiteSettings.findById('site_settings')
        ]);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found. Please log in again.' });
        }

        const minAmount = settings?.min_withdrawal_amount || 500;

        if (withdrawalAmount < minAmount) {
            return res.status(400).json({ success: false, message: `Minimum withdrawal amount is ${minAmount}` });
        }

        if ((user.wallet_balance || 0) < withdrawalAmount) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
        }

        const withdrawal = await Withdrawal.create({
            user: req.user.id,
            amount: withdrawalAmount,
            payment_method: method === 'bank_transfer' ? 'Bank Transfer' : 'UPI',
            payment_details,
            status: 'pending'
        });

        user.wallet_balance -= withdrawalAmount;
        await user.save();

        await WalletTransaction.create({
            user: req.user.id,
            amount: -withdrawalAmount,
            type: 'withdrawal',
            status: 'pending',
            description: `Withdrawal request for ${withdrawalAmount}`,
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

/**
 * @desc    Get user withdrawal history
 * @route   GET /api/mobile/user/my-withdrawals
 * @access  Private
 */
exports.getMyWithdrawals = async (req, res) => {
    try {
        const withdrawals = await Withdrawal.find({ user: req.user.id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Withdrawal history fetched successfully.',
            withdrawals
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getWalletHistory = exports.getMyWallet;
