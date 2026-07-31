"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyEasebuzzWebhook = exports.verifyRazorpayWebhook = exports.verifyStripeWebhook = void 0;
const crypto_1 = __importDefault(require("crypto"));
const response_js_1 = require("../core/response.js");
/**
 * Verify Stripe webhook signature using raw request body.
 * Stripe requires express.raw() on the webhook route, not express.json().
 */
const verifyStripeWebhook = (req, res, next) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not configured. Skipping signature verification.');
        return next();
    }
    if (!sig) {
        return res.status(400).json((0, response_js_1.errorResponse)('Missing stripe-signature header', 'WEBHOOK_SIGNATURE_MISSING'));
    }
    try {
        const rawBody = req.rawBody;
        if (!rawBody) {
            return res.status(400).json((0, response_js_1.errorResponse)('Raw body not available for verification', 'WEBHOOK_RAW_BODY_MISSING'));
        }
        // Extract timestamp and signatures from header
        const parts = String(sig).split(',');
        const timestamp = parts.find(p => p.startsWith('t='))?.replace('t=', '');
        const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.replace('v1=', ''));
        if (!timestamp || signatures.length === 0) {
            return res.status(400).json((0, response_js_1.errorResponse)('Invalid stripe-signature format', 'WEBHOOK_SIGNATURE_INVALID'));
        }
        // Tolerance: reject webhooks older than 5 minutes
        const currentTimestamp = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTimestamp - parseInt(timestamp)) > 300) {
            return res.status(400).json((0, response_js_1.errorResponse)('Webhook timestamp is too old', 'WEBHOOK_TIMESTAMP_EXPIRED'));
        }
        const payload = `${timestamp}.${rawBody.toString('utf8')}`;
        const expectedSig = crypto_1.default.createHmac('sha256', webhookSecret).update(payload, 'utf8').digest('hex');
        const isValid = signatures.some(sig => crypto_1.default.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex')));
        if (!isValid) {
            return res.status(400).json((0, response_js_1.errorResponse)('Webhook signature verification failed', 'WEBHOOK_SIGNATURE_MISMATCH'));
        }
        return next();
    }
    catch (err) {
        return res.status(400).json((0, response_js_1.errorResponse)('Webhook verification error', 'WEBHOOK_VERIFICATION_ERROR'));
    }
};
exports.verifyStripeWebhook = verifyStripeWebhook;
/**
 * Verify Razorpay webhook signature.
 */
const verifyRazorpayWebhook = (req, res, next) => {
    const sig = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.warn('[RAZORPAY WEBHOOK] RAZORPAY_WEBHOOK_SECRET not configured. Skipping signature verification.');
        return next();
    }
    if (!sig) {
        return res.status(400).json((0, response_js_1.errorResponse)('Missing x-razorpay-signature header', 'WEBHOOK_SIGNATURE_MISSING'));
    }
    try {
        const rawBody = req.rawBody;
        const expectedSig = crypto_1.default.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
        if (!crypto_1.default.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
            return res.status(400).json((0, response_js_1.errorResponse)('Razorpay signature verification failed', 'WEBHOOK_SIGNATURE_MISMATCH'));
        }
        return next();
    }
    catch (err) {
        return res.status(400).json((0, response_js_1.errorResponse)('Webhook verification error', 'WEBHOOK_VERIFICATION_ERROR'));
    }
};
exports.verifyRazorpayWebhook = verifyRazorpayWebhook;
/**
 * Verify Easebuzz payment hash.
 * Easebuzz uses SHA-512 of the key + transaction data + salt.
 */
const verifyEasebuzzWebhook = (req, res, next) => {
    const webhookSecret = process.env.EASEBUZZ_SALT;
    if (!webhookSecret) {
        console.warn('[EASEBUZZ WEBHOOK] EASEBUZZ_SALT not configured. Skipping signature verification.');
        return next();
    }
    try {
        const { hash, key, txnid, amount, productinfo, firstname, email, status } = req.body;
        if (!hash) {
            return res.status(400).json((0, response_js_1.errorResponse)('Missing hash in Easebuzz payload', 'WEBHOOK_SIGNATURE_MISSING'));
        }
        // Easebuzz hash formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
        const hashStr = [
            webhookSecret, status, '', '', '', '', '', '', '', '',
            email, firstname, productinfo, amount, txnid, key
        ].join('|');
        const expectedHash = crypto_1.default.createHash('sha512').update(hashStr).digest('hex');
        if (!crypto_1.default.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))) {
            return res.status(400).json((0, response_js_1.errorResponse)('Easebuzz hash verification failed', 'WEBHOOK_SIGNATURE_MISMATCH'));
        }
        return next();
    }
    catch (err) {
        return res.status(400).json((0, response_js_1.errorResponse)('Webhook verification error', 'WEBHOOK_VERIFICATION_ERROR'));
    }
};
exports.verifyEasebuzzWebhook = verifyEasebuzzWebhook;
