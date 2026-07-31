"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhoneOtp = exports.issuePhoneOtp = exports.normalizePhoneNumber = void 0;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const otpStore = new Map();
const normalizePhoneNumber = (phone, countryCode) => {
    const digits = phone.replace(/\D/g, '');
    const code = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    return `${code}${digits}`;
};
exports.normalizePhoneNumber = normalizePhoneNumber;
const cleanupExpired = (key, record) => {
    if (record.expiresAt <= Date.now()) {
        otpStore.delete(key);
        return true;
    }
    return false;
};
const generateCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const dispatchOtp = async (phoneNumber, code) => {
    // Plug SMS provider here (Twilio, MSG91, etc.).
    if (!process.env.SMS_PROVIDER_ENABLED || process.env.SMS_PROVIDER_ENABLED !== 'true') {
        console.log(`[DEV MODE] OTP for ${phoneNumber}: ${code}`);
        return true;
    }
    console.log(`[SMS] OTP dispatched to ${phoneNumber}`);
    return true;
};
const issuePhoneOtp = async (phone, countryCode) => {
    const phoneNumber = (0, exports.normalizePhoneNumber)(phone, countryCode);
    const code = generateCode();
    otpStore.set(phoneNumber, {
        code,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
    });
    await dispatchOtp(phoneNumber, code);
    return { phoneNumber };
};
exports.issuePhoneOtp = issuePhoneOtp;
export const issueEmailOtp = async (email) => {
    const key = `email:${String(email).toLowerCase().trim()}`;
    const code = generateCode();
    otpStore.set(key, {
        code,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
        attempts: 0,
    });
    return { email, code };
};
export const verifyEmailOtp = (email, code) => {
    const key = `email:${String(email).toLowerCase().trim()}`;
    const record = otpStore.get(key);
    if (!record || cleanupExpired(key, record)) {
        return { valid: false, reason: 'EXPIRED' };
    }
    if (record.attempts >= 3) {
        otpStore.delete(key);
        return { valid: false, reason: 'TOO_MANY_ATTEMPTS' };
    }
    if (record.code !== String(code).trim()) {
        record.attempts += 1;
        otpStore.set(key, record);
        const remaining = 3 - record.attempts;
        return { valid: false, reason: 'INVALID', remainingAttempts: remaining };
    }
    otpStore.delete(key);
    return { valid: true };
};
export const verifyPhoneOtp = (phone, countryCode, code) => {
    const phoneNumber = (0, exports.normalizePhoneNumber)(phone, countryCode);
    const record = otpStore.get(phoneNumber);
    if (!record || cleanupExpired(phoneNumber, record)) {
        return { valid: false, reason: 'EXPIRED' };
    }
    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        otpStore.delete(phoneNumber);
        return { valid: false, reason: 'TOO_MANY_ATTEMPTS' };
    }
    if (record.code !== code.trim()) {
        record.attempts += 1;
        otpStore.set(phoneNumber, record);
        return { valid: false, reason: 'INVALID' };
    }
    otpStore.delete(phoneNumber);
    return { valid: true };
};
exports.verifyPhoneOtp = verifyPhoneOtp;
