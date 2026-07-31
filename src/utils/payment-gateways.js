"use strict";
/** Feature-flagged payment gateways. Production default: Easebuzz only. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseProductInfo = exports.buildProductInfo = exports.assertGatewayAllowed = exports.listPublicGateways = exports.isGatewayEnabled = void 0;
const truthy = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
const isGatewayEnabled = (code) => {
    switch (code) {
        case 'easebuzz':
            // Enabled whenever keys exist (or explicitly forced on for listing in staging).
            return !!(process.env.EASEBUZZ_KEY && process.env.EASEBUZZ_SALT);
        case 'razorpay':
            return truthy(process.env.ENABLE_RAZORPAY) && !!process.env.RAZORPAY_KEY_ID;
        case 'stripe':
            return truthy(process.env.ENABLE_STRIPE) && !!process.env.STRIPE_SECRET_KEY;
        default:
            return false;
    }
};
exports.isGatewayEnabled = isGatewayEnabled;
const listPublicGateways = () => {
    const all = [
        { code: 'easebuzz', name: 'Easebuzz', enabled: (0, exports.isGatewayEnabled)('easebuzz') },
        { code: 'razorpay', name: 'Razorpay', enabled: (0, exports.isGatewayEnabled)('razorpay') },
        { code: 'stripe', name: 'Stripe', enabled: (0, exports.isGatewayEnabled)('stripe') },
    ];
    // Production / default: only return enabled gateways (Easebuzz only unless flags set).
    return all.filter((g) => g.enabled);
};
exports.listPublicGateways = listPublicGateways;
const assertGatewayAllowed = (gateway) => {
    if (!['easebuzz', 'razorpay', 'stripe'].includes(gateway)) {
        throw new Error('INVALID_GATEWAY');
    }
    if (!(0, exports.isGatewayEnabled)(gateway)) {
        throw new Error('PAYMENT_GATEWAY_DISABLED');
    }
    return gateway;
};
exports.assertGatewayAllowed = assertGatewayAllowed;
/** Encode subscription intent into Easebuzz productinfo for webhook activation. */
const buildProductInfo = (metadata) => {
    const purpose = String(metadata.purpose || 'payment');
    if (purpose === 'subscription' && metadata.planId) {
        const cycle = String(metadata.billingCycle || 'monthly').toLowerCase() === 'yearly'
            ? 'yearly'
            : 'monthly';
        return `subscription|${metadata.planId}|${cycle}`;
    }
    return purpose.slice(0, 100);
};
exports.buildProductInfo = buildProductInfo;
const parseProductInfo = (productinfo) => {
    const parts = String(productinfo || '').split('|');
    if (parts[0] === 'subscription' && parts[1]) {
        return {
            purpose: 'subscription',
            planId: parts[1],
            billingCycle: parts[2] === 'yearly' ? 'yearly' : 'monthly',
        };
    }
    return { purpose: productinfo };
};
exports.parseProductInfo = parseProductInfo;
