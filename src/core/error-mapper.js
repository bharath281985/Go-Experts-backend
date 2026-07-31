"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapError = void 0;
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_error_js_1 = require("./app-error.js");
const isPrismaColumnError = (message) => /column .* does not exist|unknown column|invalid.*invocation/i.test(message);
const mapError = (err) => {
    if (err instanceof app_error_js_1.AppError) {
        return {
            status: err.statusCode,
            message: err.message,
            code: err.code,
            errors: err.errors,
        };
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                return {
                    status: 409,
                    message: 'This record already exists',
                    code: 'DUPLICATE_RECORD',
                    errors: [],
                };
            case 'P2025':
                return {
                    status: 404,
                    message: 'Record not found',
                    code: 'NOT_FOUND',
                    errors: [],
                };
            case 'P2022':
            case 'P2021':
                console.error('[DB] Column missing:', err.message);
                return {
                    status: 503,
                    message: 'Service temporarily unavailable. Please try again later.',
                    code: 'SERVICE_UNAVAILABLE',
                    errors: [],
                };
            case 'P1000':
                console.error('[DB] Authentication failed:', err.message);
                return {
                    status: 503,
                    message: 'Service temporarily unavailable. Please try again later.',
                    code: 'SERVICE_UNAVAILABLE',
                    errors: [],
                };
            default:
                console.error('[Prisma]', err.code, err.message);
                return {
                    status: 500,
                    message: 'Service temporarily unavailable. Please try again later.',
                    code: 'SERVICE_UNAVAILABLE',
                    errors: [],
                };
        }
    }
    if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        console.error('[Prisma validation]', err.message);
        return {
            status: 500,
            message: 'Service temporarily unavailable. Please try again later.',
            code: 'SERVICE_UNAVAILABLE',
            errors: [],
        };
    }
    if (err instanceof jsonwebtoken_1.default.TokenExpiredError) {
        return {
            status: 401,
            message: 'Session expired. Please login again.',
            code: 'TOKEN_EXPIRED',
            errors: [],
        };
    }
    if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
        return {
            status: 401,
            message: 'Invalid session. Please login again.',
            code: 'INVALID_TOKEN',
            errors: [],
        };
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'ACCOUNT_INACTIVE') {
        return {
            status: 403,
            message: 'Your account is inactive. Please contact support.',
            code: 'ACCOUNT_INACTIVE',
            errors: [],
        };
    }
    if (message === 'FIREBASE_NOT_CONFIGURED') {
        return {
            status: 503,
            message: 'Social login is not configured yet',
            code: 'SOCIAL_LOGIN_NOT_CONFIGURED',
            errors: [],
        };
    }
    if (isPrismaColumnError(message)) {
        console.error('[DB schema]', message);
        return {
            status: 503,
            message: 'Service temporarily unavailable. Please try again later.',
            code: 'SERVICE_UNAVAILABLE',
            errors: [],
        };
    }
    if (/password reset/i.test(message)) {
        return {
            status: 400,
            message: 'Invalid or expired reset token',
            code: 'INVALID_RESET_TOKEN',
            errors: [],
        };
    }
    if (/prisma|sql|invocation|constraint/i.test(message)) {
        console.error('[Internal]', message);
        return {
            status: 500,
            message: 'Something went wrong. Please try again later.',
            code: 'INTERNAL_SERVER_ERROR',
            errors: [],
        };
    }
    const anyErr = err;
    return {
        status: anyErr.status || 500,
        message: message || 'Something went wrong. Please try again later.',
        code: anyErr.code || 'INTERNAL_SERVER_ERROR',
        errors: anyErr.errors || [],
    };
};
exports.mapError = mapError;
