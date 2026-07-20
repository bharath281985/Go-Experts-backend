export function sendResponse(res, statusCode, success, message, data, options = {}) {
    const requestId = res.req.requestId || `req_${Math.random().toString(36).substring(2, 11)}`;
    const response = {
        success,
        message,
        data,
        meta: options.meta,
        pagination: options.pagination,
        errors: options.errors,
        requestId,
        timestamp: new Date().toISOString(),
    };
    return res.status(statusCode).json(response);
}
