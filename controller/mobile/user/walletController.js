const User = require('../../../models/User');

/**
 * @desc    Get wallet history
 * @route   GET /api/mobile/user/wallet
 * @access  Private
 */
exports.getWalletHistory = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('wallet_balance');
        
        res.status(200).json({ 
            success: true, 
            balance: user.wallet_balance || 0,
            transactions: [] // Placeholder for actual transaction records
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
