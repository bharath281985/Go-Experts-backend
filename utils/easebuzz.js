const crypto = require('crypto');

/**
 * Easebuzz Hash Generation
 * Formula: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
 */
exports.generatePaymentHash = (data, salt, key) => {
    const hashString = `${key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|${data.udf1 || ''}|${data.udf2 || ''}|${data.udf3 || ''}|${data.udf4 || ''}|${data.udf5 || ''}|${data.udf6 || ''}|${data.udf7 || ''}|${data.udf8 || ''}|${data.udf9 || ''}|${data.udf10 || ''}|${salt}`;
    return crypto.createHash('sha512').update(hashString).digest('hex');
};

/**
 * Reverse Hash Verification (Success Callback)
 * Formula: salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 */
exports.verifyResponseHash = (data, salt, key) => {
    const hashString = `${salt}|${data.status}|${data.udf10 || ''}|${data.udf9 || ''}|${data.udf8 || ''}|${data.udf7 || ''}|${data.udf6 || ''}|${data.udf5 || ''}|${data.udf4 || ''}|${data.udf3 || ''}|${data.udf2 || ''}|${data.udf1 || ''}|${data.email}|${data.firstname}|${data.productinfo}|${data.amount}|${data.txnid}|${key}`;
    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
    return calculatedHash === data.hash;
};
