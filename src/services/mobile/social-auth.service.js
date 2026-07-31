"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAppleIdToken = exports.verifyGoogleIdToken = void 0;
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const googleAudiences = () => [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    // Flutter app OAuth clients
    '817575811603-sjk8n64ib4a7mt6nrojjtgg5uhti6j0q.apps.googleusercontent.com', // web / server
    '817575811603-m2jfe6l1lunbiunjvmlrilj7p6ig25kt.apps.googleusercontent.com', // android
    '817575811603-7pgbim1pbp6ps0h89594hnh9kouj2jgc.apps.googleusercontent.com', // ios
].filter((value) => Boolean(value));
const appleAudiences = () => [
    process.env.APPLE_CLIENT_ID,
    process.env.APPLE_BUNDLE_ID,
    'com.doorstephub.goexperts',
].filter((value) => Boolean(value));
/**
 * Verifies a native Google Sign-In ID token (not a Firebase token).
 */
const verifyGoogleIdToken = async (idToken) => {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok) {
        throw new Error('INVALID_GOOGLE_TOKEN');
    }
    const payload = (await response.json());
    const audiences = googleAudiences();
    const audienceOk = audiences.length === 0 ||
        (payload.aud != null && audiences.includes(payload.aud)) ||
        (payload.azp != null && audiences.includes(payload.azp));
    if (!audienceOk) {
        throw new Error('INVALID_GOOGLE_TOKEN');
    }
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!payload.email || !emailVerified || !payload.sub) {
        throw new Error('GOOGLE_EMAIL_UNAVAILABLE');
    }
    return {
        email: payload.email,
        fullName: payload.name,
        picture: payload.picture,
        provider: 'google',
        subject: payload.sub,
    };
};
exports.verifyGoogleIdToken = verifyGoogleIdToken;
/**
 * Verifies a native Sign in with Apple identity token (not a Firebase token).
 */
const verifyAppleIdToken = async (idToken, fallbackEmail) => {
    const decoded = jsonwebtoken_1.default.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        throw new Error('INVALID_APPLE_TOKEN');
    }
    const keysResponse = await fetch('https://appleid.apple.com/auth/keys');
    if (!keysResponse.ok) {
        throw new Error('APPLE_KEYS_UNAVAILABLE');
    }
    const { keys } = (await keysResponse.json());
    const jwk = keys.find((key) => key.kid === decoded.header.kid);
    if (!jwk) {
        throw new Error('INVALID_APPLE_TOKEN');
    }
    const publicKey = (0, crypto_1.createPublicKey)({
        key: {
            kty: jwk.kty,
            n: jwk.n,
            e: jwk.e,
        },
        format: 'jwk',
    });
    const audiences = appleAudiences();
    if (audiences.length === 0) {
        throw new Error('APPLE_AUDIENCE_UNAVAILABLE');
    }
    // jwt.verify expects string | RegExp | non-empty tuple (not string[]).
    const audience = audiences.length === 1
        ? audiences[0]
        : [audiences[0], ...audiences.slice(1)];
    const payload = jsonwebtoken_1.default.verify(idToken, publicKey, {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience,
    });
    const email = payload.email || fallbackEmail;
    if (!email || !payload.sub) {
        throw new Error('APPLE_EMAIL_UNAVAILABLE');
    }
    return {
        email,
        provider: 'apple',
        subject: payload.sub,
    };
};
exports.verifyAppleIdToken = verifyAppleIdToken;
