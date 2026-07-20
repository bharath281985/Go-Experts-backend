import crypto from "crypto";
import { prisma } from "../config/database.js";
import { sendResponse } from "../common/helpers/response.helper.js";
/**
 * SHA-256 helper for API Key hashing
 */
export function hashApiKey(key) {
    return crypto.createHash("sha256").update(key).digest("hex");
}
/**
 * API Key Authentication Middleware
 *
 * Verifies key signature, hash match, active/expired status, and resolves roles/scopes.
 * Stores telemetry logs asynchronously in ApiUsageLog.
 */
export const apiKeyAuthMiddleware = async (req, res, next) => {
    const t0 = Date.now();
    const apiKeyRaw = req.headers["x-api-key"] || req.query.apiKey;
    if (!apiKeyRaw || typeof apiKeyRaw !== "string") {
        return sendResponse(res, 401, false, "Unauthorized: Missing API Key in request.");
    }
    try {
        const keyHash = hashApiKey(apiKeyRaw);
        const keyRecord = await prisma.apiKey.findUnique({
            where: { keyHash },
        });
        if (!keyRecord) {
            return sendResponse(res, 401, false, "Unauthorized: Invalid API Key.");
        }
        if (keyRecord.status !== "active") {
            return sendResponse(res, 401, false, `Unauthorized: API Key status is ${keyRecord.status}.`);
        }
        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
            // Mark as expired on demand if reached
            await prisma.apiKey.update({
                where: { id: keyRecord.id },
                data: { status: "expired" },
            });
            return sendResponse(res, 401, false, "Unauthorized: API Key has expired.");
        }
        // Map scope list
        const scopesList = keyRecord.scopes.split(",").map((s) => s.trim());
        // Attach to request
        req.apiKeyDetails = keyRecord;
        req.apiKeyScopes = scopesList;
        req.user = {
            id: `apikey_${keyRecord.id}`,
            email: `apikey_${keyRecord.name}@goexperts.com`,
            role: keyRecord.roleMapping,
        };
        // Track usage asynchronous & fire-and-forget
        const originalEnd = res.end.bind(res);
        res.end = function (...args) {
            res.end = originalEnd;
            originalEnd(...args);
            const duration = Date.now() - t0;
            prisma.apiUsageLog.create({
                data: {
                    apiKeyId: keyRecord.id,
                    ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || null,
                    method: req.method,
                    route: req.originalUrl || req.url,
                    apiVersion: req.apiVersion || "v1",
                    statusCode: res.statusCode,
                    responseTime: duration,
                },
            }).catch(() => { });
            // Increment counters
            prisma.apiKey.update({
                where: { id: keyRecord.id },
                data: {
                    usageCount: { increment: 1 },
                    lastUsedAt: new Date(),
                },
            }).catch(() => { });
        };
        next();
    }
    catch (err) {
        next(err);
    }
};
/**
 * Scope Guard Middleware
 *
 * Asserts that the authenticated API Key has the requested scopes before resolving route.
 */
export const requireScopes = (requiredScopes) => {
    return (req, res, next) => {
        const keyScopes = req.apiKeyScopes;
        if (!keyScopes) {
            return sendResponse(res, 403, false, "Forbidden: Missing credential authorization details.");
        }
        // Check if key has wildcard scope or matches all required scopes
        const hasWildcard = keyScopes.includes("write:all") || keyScopes.includes("admin");
        const hasMatches = requiredScopes.every((s) => keyScopes.includes(s));
        if (!hasWildcard && !hasMatches) {
            return sendResponse(res, 403, false, "Forbidden: Insufficient API Key scopes.", undefined, {
                errors: {
                    code: "INSUFFICIENT_SCOPES",
                    message: `Requires scopes: [${requiredScopes.join(", ")}]`,
                },
            });
        }
        next();
    };
};
