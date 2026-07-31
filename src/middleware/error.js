"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const response_js_1 = require("../core/response.js");
const error_mapper_js_1 = require("../core/error-mapper.js");
const errorHandler = (err, req, res, _next) => {
    if (res.headersSent) {
        return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json((0, response_js_1.errorResponse)('Invalid JSON payload', 'INVALID_JSON'));
        return;
    }
    const bodyError = err;
    if (bodyError.type === 'entity.too.large') {
        res.status(bodyError.status || 413).json((0, response_js_1.errorResponse)('Payload too large', 'PAYLOAD_TOO_LARGE'));
        return;
    }
    if (err instanceof Error && err.message === 'Not allowed by CORS') {
        res.status(403).json((0, response_js_1.errorResponse)('Origin is not allowed to access this API', 'CORS_NOT_ALLOWED'));
        return;
    }
    const mapped = (0, error_mapper_js_1.mapError)(err);
    if (mapped.status >= 500) {
        console.error('[Error]', req.method, req.path, err);
    }
    res.status(mapped.status).json((0, response_js_1.errorResponse)(mapped.message, mapped.code, mapped.errors));
};
exports.errorHandler = errorHandler;
