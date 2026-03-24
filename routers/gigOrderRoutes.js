const express = require('express');
const router = express.Router();
const { createGigOrder, getMyGigOrders } = require('../controller/gigOrderController');
const { protect } = require('../middleware/auth');

router.route('/')
    .post(protect, createGigOrder);

router.get('/my', protect, getMyGigOrders);

module.exports = router;
