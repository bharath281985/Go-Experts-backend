"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.otpIpLimiter = exports.otpEmailLimiter = exports.globalApiLimiter = exports.authLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));

// 1. Auth Limiter: Max 15 login/register attempts per 15 minutes per IP
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: 'Too many authentication attempts. Please try again after 15 minutes.',
            data: null,
            code: 'TOO_MANY_AUTH_ATTEMPTS',
            retryAfterSeconds: 900
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 2. Global API Limiter: Max 150 requests per minute per IP
exports.globalApiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 150,
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: 'Too many requests. Please slow down and try again in a minute.',
            data: null,
            code: 'TOO_MANY_REQUESTS',
            retryAfterSeconds: 60
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 3. OTP Per-IP Limiter: Max 5 OTP requests per hour per IP (prevents automated bot attacks)
exports.otpIpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: 'Too many OTP requests from this device. Please wait an hour before trying again.',
            data: null,
            code: 'TOO_MANY_OTP_REQUESTS_IP',
            retryAfterSeconds: 3600
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 4. OTP Per-Email/Phone Limiter: Max 3 OTP requests per 15 mins per target
exports.otpEmailLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    keyGenerator: (req) => {
        const target = req.body?.email || req.body?.phone || req.ip;
        return `otp_limit:${String(target).toLowerCase().trim()}`;
    },
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            message: 'You have reached the maximum OTP request limit for this email. Please try again after 15 minutes.',
            data: null,
            code: 'TOO_MANY_OTP_REQUESTS',
            retryAfterSeconds: 900
        });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

