const express = require('express');
const router = express.Router();
const { register, login, sendOTP, verifyOTP } = require('../../controller/mobile/mobileAuthController');
const validate = require('../../middleware/validate');
const { registerSchema, loginSchema } = require('../../utils/validationSchemas');
const rateLimit = require('express-rate-limit');

// Rate limiter for mobile auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per windowMs
    message: {
        success: false,
        message: "Too many attempts from this IP, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply rate limiter to all auth routes
router.use(authLimiter);

// Register mobile user
router.post('/register', validate(registerSchema), register);

// Login mobile user 
router.post('/login', validate(loginSchema), login);

// OTP routes for mobile
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

module.exports = router;
