const express = require('express');
const router = express.Router();
const { initiatePayment, handlePaymentResponse } = require('../controller/paymentController');
const { protect } = require('../middleware/auth');

router.post('/initiate', protect, initiatePayment);
router.post('/response', handlePaymentResponse); // No protect because it's a callback from Easebuzz

module.exports = router;
