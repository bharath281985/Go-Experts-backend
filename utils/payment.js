const crypto = require('crypto');
const axios = require('axios');

const EASEBUZZ_MERCHANT_KEY = process.env.EASEBUZZ_MERCHANT_KEY;
const EASEBUZZ_SALT_KEY = process.env.EASEBUZZ_SALT_KEY;
const EASEBUZZ_ENV = process.env.EASEBUZZ_ENV; // 'test' or 'prod'

const getBaseUrl = () => {
    return EASEBUZZ_ENV === 'test'
        ? 'https://testpay.easebuzz.in'
        : 'https://pay.easebuzz.in';
};

/**
 * Generate Hash for Easebuzz
 * hash = sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt)
 */
const generateHash = (data) => {
    const hashString = `${EASEBUZZ_MERCHANT_KEY}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${EASEBUZZ_SALT_KEY}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
};

/**
 * Initiate Payment
 */
const initiatePayment = async (paymentData) => {
    const hash = generateHash(paymentData);

    // In a real flow, you usually redirect the user from the frontend
    // using the hash and access keys.
    // This server-side function can be used to get the access key if using the Easebuzz API flow.

    // For now, we return the hash and mandatory data for the frontend to use
    return {
        ...paymentData,
        key: EASEBUZZ_MERCHANT_KEY,
        hash: hash
    };
};

module.exports = {
    generateHash,
    initiatePayment
};
