const express = require('express');
const router = express.Router();
const walletController = require('../../../controller/mobile/user/walletController');

router.get('/wallet', walletController.getMyWallet);
router.get('/my-wallet', walletController.getMyWallet);
router.post('/withdraw', walletController.requestWithdrawal);
router.get('/my-withdrawals', walletController.getMyWithdrawals);

module.exports = router;
