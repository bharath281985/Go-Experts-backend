"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
/** Application error with safe client-facing message and code. */
class AppError extends Error {
    statusCode;
    code;
    errors;
    constructor(message, statusCode, code, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.errors = errors;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
