import { Router } from 'express';
import {
  login, register, getMe, logout, refresh,
  forgotPassword, resetPassword, changePassword,
  updateMe, updateAvatar, sendEmailVerification, verifyEmail, deleteAccount,
  sendOtp, verifyOtp, resendOtp, checkEmail,
} from './auth.controller.js';
import { validate } from '../../../middleware/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import {
  loginSchema, registerSchema, forgotPasswordSchema,
  resetPasswordSchema, changePasswordSchema, updateProfileSchema,
  sendOtpSchema, verifyOtpSchema,
} from '../../../validators/auth.validator.js';

import { authLimiter } from '../../../middleware/rate-limit.js';
import { upload, handleUploadError } from '../../../middleware/upload.js';
import {
  googleSocialLogin,
  appleSocialLogin,
  appleSignInCallback,
} from './social.controller.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/signup', authLimiter, register);
router.post('/social/google', authLimiter, googleSocialLogin);
router.post('/social/apple', authLimiter, appleSocialLogin);
router.post('/social/apple/callback', appleSignInCallback);
router.post('/apple/callback', appleSignInCallback);
router.post('/logout', authenticate, logout);
router.post('/refresh', refresh);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, upload.single('file'), handleUploadError, validate(updateProfileSchema), updateMe);
router.post('/me/avatar', authenticate, upload.single('file'), handleUploadError, updateAvatar);
router.put('/me/avatar', authenticate, upload.single('file'), handleUploadError, updateAvatar);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.post('/send-email-verification', authenticate, sendEmailVerification);
router.post('/verify-email', verifyEmail);
router.delete('/account', authenticate, deleteAccount);

router.post('/send-otp', authLimiter, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/resend-otp', authLimiter, validate(sendOtpSchema), resendOtp);
router.post('/check-email', authLimiter, checkEmail);

export default router;
