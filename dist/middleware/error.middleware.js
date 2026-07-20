import { sendResponse } from "../common/helpers/response.helper.js";
export class ApiError extends Error {
    statusCode;
    errors;
    constructor(statusCode, message, errors) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
export const errorMiddleware = (err, req, res, next) => {
    const statusCode = err instanceof ApiError ? err.statusCode : 500;
    const message = err.message || "Internal Server Error";
    const errors = err instanceof ApiError ? err.errors : undefined;
    // Print 500 error stack in dev environment
    if (statusCode === 500) {
        console.error("💥 System Internal Error:", err);
    }
    return sendResponse(res, statusCode, false, message, undefined, { errors });
};
