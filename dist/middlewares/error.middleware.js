import fs from "fs";
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
const STATUS_MESSAGES = {
    400: "The request could not be completed. Please check the submitted details.",
    401: "Authentication is required. Please sign in again.",
    403: "You do not have permission to perform this action.",
    404: "The requested record could not be found.",
    409: "A matching record already exists.",
    422: "Some submitted details are invalid.",
    429: "Too many requests. Please try again later.",
    500: "The server could not complete this request. Please try again later.",
};
function getFriendlyErrorMessage(err, statusCode) {
    if (err instanceof ApiError)
        return err.message || STATUS_MESSAGES[statusCode];
    const message = err.message || "";
    const missingField = message.match(/Argument `([^`]+)` is missing/i);
    if (missingField?.[1])
        return `Missing required field: ${missingField[1]}.`;
    const unknownArg = message.match(/Unknown arg(?:ument)? `([^`]+)`/i);
    if (unknownArg?.[1])
        return `Unsupported field "${unknownArg[1]}". Please review the form and try again.`;
    const invalidArg = message.match(/Argument `([^`]+)`: ([\s\S]+)/i);
    if (invalidArg?.[1]) {
        const reason = invalidArg[2].split('\n')[0].replace(/\.$/, '').trim();
        return `Invalid value for "${invalidArg[1]}": ${reason}. Please review the form and try again.`;
    }
    const code = err.code;
    if (code === "P2002" && String(err.meta?.target ?? message).includes("email")) {
        return "A user with this email already exists. Please use a different email address.";
    }
    if (/Unique constraint failed/i.test(message) && /users_email_key|email/i.test(message)) {
        return "A user with this email already exists. Please use a different email address.";
    }
    if (code === "P2002" || /Unique constraint failed/i.test(message))
        return "A record with these details already exists.";
    if ((code === "P2003" || /Foreign key constraint/i.test(message)) && /user_id/i.test(message)) {
        return "Please select a valid user. The selected user does not exist.";
    }
    if ((code === "P2003" || /Foreign key constraint/i.test(message)) && /plan_id/i.test(message)) {
        return "Please select a valid subscription plan. The selected plan does not exist.";
    }
    if (code === "P2003" || /Foreign key constraint/i.test(message))
        return "Please select valid related records before saving.";
    if (code === "P2025")
        return "The requested record could not be found.";
    const unknownColumn = message.match(/Unknown column [`'"]([^`'"]+)[`'"]/i)?.[1] ||
        message.match(/column [`'"]([^`'"]+)[`'"] does not exist/i)?.[1];
    if (unknownColumn) {
        return `Database is missing field "${unknownColumn}". Please run pending migrations and try again.`;
    }
    if (/Can't reach database server|database server is running|PrismaClientInitializationError|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
        return "Database connection error. Please make sure the database server is running.";
    }
    if (/Invalid `prisma\./i.test(message) || /PrismaClient/i.test(message)) {
        try {
            fs.appendFileSync('prisma-debug.log', `[${new Date().toISOString()}] PRISMA ERROR:\n${message}\n\n`);
        }
        catch { }
        const lines = message.split('\n').map(l => l.trim()).filter(Boolean);
        // Reverse the lines to find the actual error detail which is usually at the bottom, 
        // avoiding the generic "Invalid `prisma.model.findFirst()` invocation" line.
        const relevantLine = [...lines].reverse().find(l => (l.includes('Argument') || l.includes('Type') || l.includes('Unknown') || l.includes('Error converting field'))
            && !l.startsWith('Invalid `prisma.')) || lines[lines.length - 1] || message;
        const cleanLine = relevantLine.replace(/^(Validation error:\s*)+/i, '');
        return `Validation error: ${cleanLine}`;
    }
    if (statusCode >= 500)
        return STATUS_MESSAGES[statusCode] ?? STATUS_MESSAGES[500];
    return message || STATUS_MESSAGES[statusCode] || STATUS_MESSAGES[500];
}
function getErrorStatusCode(err) {
    if (err instanceof ApiError)
        return err.statusCode;
    const code = err.code;
    const message = err.message || "";
    if (code === "P2002" || /Unique constraint failed/i.test(message))
        return 409;
    if (code === "P2003")
        return 409;
    if (code === "P2025")
        return 404;
    return 500;
}
export const errorMiddleware = (err, req, res, next) => {
    const statusCode = getErrorStatusCode(err);
    const message = getFriendlyErrorMessage(err, statusCode);
    const errors = err instanceof ApiError ? err.errors : undefined;
    // Print 500 error stack in dev environment
    if (statusCode === 500) {
        console.error("💥 System Internal Error:", err);
    }
    return sendResponse(res, statusCode, false, message, undefined, { errors });
};
