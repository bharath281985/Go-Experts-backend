"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorResponse = exports.successResponse = void 0;
const successResponse = (message, data, meta) => ({
    success: true,
    message,
    data: (data ?? null),
    meta: meta ?? null,
    timestamp: new Date().toISOString()
});
exports.successResponse = successResponse;
const errorResponse = (message, code = 'ERROR', errors = []) => ({
    success: false,
    message,
    data: null,
    meta: null,
    errors,
    code,
    timestamp: new Date().toISOString()
});
exports.errorResponse = errorResponse;
