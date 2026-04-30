const express = require('express');
const router = express.Router();
const walletController = require('../../../controller/mobile/user/walletController');

router.get('/wallet', walletController.getWalletHistory);

module.exports = router;
