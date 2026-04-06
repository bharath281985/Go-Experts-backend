const express = require('express');
const router = express.Router();
const { register, login, sendOTP, verifyOTP, verifyEmail, resendVerificationEmail, forgotPassword, resetPassword, getMe, updateProfile, updatePassword, deleteAccount, getUserById } = require('../controller/authController');
const validate = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../utils/validationSchemas');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);

// Protected routes
const uploadFields = upload.fields([
    { name: 'profile', maxCount: 1 },
    { name: 'pan_card', maxCount: 1 },
    { name: 'aadhar_card', maxCount: 1 },
    { name: 'educational', maxCount: 5 },
    { name: 'experience_letter', maxCount: 1 },
    { name: 'work_images', maxCount: 5 }
]);

router.get('/me', protect, getMe);
router.post('/resend-verification', protect, resendVerificationEmail);
router.put('/update-profile', protect, uploadFields, updateProfile);
router.put('/update-password', protect, updatePassword);
router.get('/users/:id', protect, getUserById);
router.delete('/delete-account', protect, deleteAccount);

module.exports = router;

