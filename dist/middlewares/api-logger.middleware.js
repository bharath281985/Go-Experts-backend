import { prisma } from "../config/database.js";
/**
 * API Request Logger Middleware
 *
 * Wraps res.end() to capture method, URL, statusCode, responseTime,
 * userId (from JWT), IP address, and user-agent for every API request.
 *
 * Uses fire-and-forget DB write — does NOT slow down responses.
 */
export const apiLoggerMiddleware = (req, res, next) => {
    const startTime = Date.now();
    // Store original res.end
    const originalEnd = res.end.bind(res);
    // Override res.end to hook into response completion
    res.end = function (...args) {
        // Restore immediately so response is not delayed
        res.end = originalEnd;
        originalEnd(...args);
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;
        // Skip health check pings and static file requests to reduce noise
        const url = req.originalUrl || req.url;
        if (url === "/health" || url.startsWith("/uploads"))
            return;
        // Extract userId from JWT-decoded user attached by authMiddleware
        const userId = req.user?.id || null;
        const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.socket?.remoteAddress ||
            null;
        const userAgent = req.headers["user-agent"] || null;
        let error = null;
        if (statusCode >= 400) {
            error = `HTTP ${statusCode}`;
        }
        // Fire-and-forget — don't await
        prisma.apiRequestLog
            .create({
            data: {
                method: req.method,
                url,
                statusCode,
                responseTime,
                userId,
                ipAddress,
                userAgent,
                error,
            },
        })
            .catch((err) => {
            // Silently swallow — logging must never crash the server
            console.error("[API LOGGER] Failed to write log:", err?.message);
        });
    };
    next();
};
