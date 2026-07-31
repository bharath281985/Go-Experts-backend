import crypto from 'crypto';
const getEasebuzzBaseUrl = () => process.env.EASEBUZZ_ENV === 'live'
    ? 'https://pay.easebuzz.in'
    : 'https://testpay.easebuzz.in';
export const generateEasebuzzHash = (parts) => crypto.createHash('sha512').update(parts.join('|')).digest('hex');
export const initiateEasebuzzPayment = async (amount, currency, metadata = {}) => {
    const key = process.env.EASEBUZZ_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    if (!key || !salt)
        throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');
    const txnid = `EB${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const productinfo = String(metadata.productinfo || metadata.purpose || metadata.planId || 'GoExperts Payment');
    const firstname = String(metadata.firstname || metadata.fullName || 'GoExperts User');
    const email = String(metadata.email || 'user@goexperts.in');
    const phone = String(metadata.phone || '9999999999');
    const surl = String(metadata.successUrl || process.env.EASEBUZZ_SUCCESS_URL || 'https://goexperts.in/payment/success');
    const furl = String(metadata.failureUrl || process.env.EASEBUZZ_FAILURE_URL || 'https://goexperts.in/payment/failure');
    const hash = generateEasebuzzHash([
        key,
        txnid,
        amount.toFixed(2),
        productinfo,
        firstname,
        email,
        '', '', '', '', '', '', '', '', '', '',
        salt,
    ]);
    const body = new URLSearchParams({
        key,
        txnid,
        amount: amount.toFixed(2),
        productinfo,
        firstname,
        email,
        phone,
        surl,
        furl,
        hash,
    });
    const baseUrl = getEasebuzzBaseUrl();
    const response = await fetch(`${baseUrl}/payment/initiateLink`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const result = (await response.json());
    if (result.status !== 1 || !result.data) {
        throw new Error(result.error_desc || 'EASEBUZZ_INITIATE_FAILED');
    }
    return {
        paymentId: txnid,
        gateway: 'easebuzz',
        amount,
        currency,
        paymentUrl: `${baseUrl}/pay/${result.data}`,
        orderId: txnid,
        gatewayPayload: {
            accessKey: result.data,
            txnid,
            // SDK pay mode: "test" | "production"
            payMode: process.env.EASEBUZZ_ENV === 'live' ? 'production' : 'test',
        },
    };
};
/** Reverse hash verification for Easebuzz callback/status. */
export const verifyEasebuzzReverseHash = (txnid, amount, status, receivedHash, email = '', firstname = '', productinfo = '') => {
    const key = process.env.EASEBUZZ_KEY;
    const salt = process.env.EASEBUZZ_SALT;
    if (!key || !salt)
        return false;
    const expected = generateEasebuzzHash([
        salt,
        status,
        '', '', '', '', '', '', '', '', '', '', '',
        email,
        firstname,
        productinfo,
        amount,
        txnid,
        key,
    ]);
    return receivedHash === expected;
};
