import { Router } from 'express';
import { exec } from 'child_process';
import { login, register, getMe, logout, refresh, forgotPassword, resetPassword, changePassword, updateMe, updateAvatar, sendEmailVerification, verifyEmail, deleteAccount, sendOtp, verifyOtp, resendOtp, } from './auth.controller.js';
import { validate } from '../../../middleware/validate.js';
import { authenticate } from '../../../middlewares/auth.js';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, updateProfileSchema, sendOtpSchema, verifyOtpSchema, } from '../../../validators/auth.validator.js';
import { authLimiter, otpEmailLimiter, otpIpLimiter } from '../../../middleware/rate-limit.js';
import { upload, handleUploadError } from '../../../middleware/upload.js';
import { googleSocialLogin, appleSocialLogin } from './social.controller.js';

const router = Router();

// TEMPORARY DB FIX ROUTE - RUNS PRISMA INTERNALLY
router.get('/fix-db', (req, res) => {
    const prismaCli = './node_modules/prisma/build/index.js';
    const cmd = `${process.execPath} ${prismaCli} db push --accept-data-loss`;
    
    exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).send(`<pre>Error: ${err.message}\nStderr: ${stderr}</pre>`);
        }
        
        exec(`${process.execPath} ${prismaCli} generate`, { cwd: process.cwd() }, (err2, stdout2, stderr2) => {
            res.send(`<pre>DB Push:\n${stdout}\n\nGenerate:\n${stdout2}</pre>`);
        });
    });
});

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/signup', authLimiter, register);
router.post('/social/google', authLimiter, googleSocialLogin);
router.post('/social/apple', authLimiter, appleSocialLogin);
router.post('/logout', authenticate, logout);
router.post('/refresh', refresh);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, validate(updateProfileSchema), updateMe);
router.post('/me/avatar', authenticate, upload.single('file'), handleUploadError, updateAvatar);
router.put('/me/avatar', authenticate, upload.single('file'), handleUploadError, updateAvatar);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/change-password', authenticate, validate(changePasswordSchema), changePassword);
router.post('/send-email-verification', otpIpLimiter, otpEmailLimiter, sendEmailVerification);
router.post('/verify-email', verifyEmail);
router.get('/verify-email', verifyEmail);
router.delete('/account', authenticate, deleteAccount);
router.post('/send-otp', otpIpLimiter, otpEmailLimiter, validate(sendOtpSchema), sendOtp);
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), verifyOtp);
router.post('/resend-otp', otpIpLimiter, otpEmailLimiter, validate(sendOtpSchema), resendOtp);
export default router;
