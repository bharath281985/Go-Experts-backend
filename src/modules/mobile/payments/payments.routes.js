import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.js';
import { verifyStripeWebhook, verifyRazorpayWebhook, verifyEasebuzzWebhook } from '../../../middleware/webhook.js';
import { getGateways, initiatePayment, verifyPayment, getHistory, getPayment, easebuzzWebhook, razorpayWebhook, stripeWebhook } from './payments.controller.js';
const router = Router();
router.get('/gateways', getGateways);
// Secured webhook endpoints with signature verification
router.post('/webhooks/easebuzz', verifyEasebuzzWebhook, easebuzzWebhook);
router.post('/webhooks/razorpay', verifyRazorpayWebhook, razorpayWebhook);
router.post('/webhooks/stripe', verifyStripeWebhook, stripeWebhook);
router.use(authenticate);
router.post('/initiate', initiatePayment);
router.post('/verify', verifyPayment);
router.get('/history', getHistory);
router.get('/:id', getPayment);
export default router;
