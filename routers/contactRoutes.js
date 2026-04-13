const express = require('express');
const router = express.Router();
const contactController = require('../controller/contactController');

router.post('/send-otp', contactController.sendContactOTP);
router.post('/verify-otp', contactController.verifyContactOTP);
router.post('/submit', contactController.submitContactMessage);
router.post('/freelancer', contactController.contactFreelancer);

module.exports = router;
