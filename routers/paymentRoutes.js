const express = require('express');
const router = express.Router();
const { initiatePayment, handlePaymentResponse, payWithWallet } = require('../controller/paymentController');
const { protect } = require('../middleware/auth');

router.post('/initiate', protect, initiatePayment);
router.post('/response', handlePaymentResponse); // No protect because it's a callback from Easebuzz
router.post('/pay-with-wallet', protect, payWithWallet);

module.exports = router;
