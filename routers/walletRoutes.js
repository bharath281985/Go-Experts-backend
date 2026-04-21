const express = require('express');
const router = express.Router();
const { getMyWallet, requestWithdrawal, getMyWithdrawals } = require('../controller/walletController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/my-wallet', getMyWallet);
router.post('/withdraw', requestWithdrawal);
router.get('/my-withdrawals', getMyWithdrawals);

module.exports = router;
