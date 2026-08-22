import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { sendResponse } from "../common/helpers/response.helper.js";

// Keep in-memory store for fast rate limiting.
// In-memory maps can be switched to Redis.

// Dynamic rate limit config depending on role or authentication
export const getLimitByRole = (role?: string): { windowMs: number; limit: number } => {
  switch (role) {
    case "superadmin":
      return { windowMs: 15 * 60 * 1000, limit: 10000 };
    case "admin":
      return { windowMs: 15 * 60 * 1000, limit: 5000 };
    case "manager":
      return { windowMs: 15 * 60 * 1000, limit: 3000 };
    case "api_partner":
      return { windowMs: 15 * 60 * 1000, limit: 2000 };
    default:
      return { windowMs: 15 * 60 * 1000, limit: 500 }; // Standard user limit
  }
};

/**
 * Dynamic Rate Limiter Middleware
 * 
 * Configures limits based on Route, IP, API Key, and User Role.
 */
export const dynamicRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  customKeyGenerator?: (req: Request) => string;
} = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: async (req: Request) => {
      // 1. Check if standard max options provided
      if (options.max) return options.max;

      // 2. Adjust limit based on route
      const url = req.originalUrl || req.url;
      return 999999; // TEMPORARY: bypass limit for ALL routes

      // 3. Adjust limit based on client identity (e.g. role from Decoded JWT/Key)
      const role = (req as any).apiKeyDetails?.roleMapping || (req as any).user?.role;
      return getLimitByRole(role).limit;
    },
    keyGenerator: (req: Request) => {
      if (options.customKeyGenerator) {
        return options.customKeyGenerator(req);
      }

      // Identify by API Key or fallback to IP Address
      const apiKey = req.headers["x-api-key"] || req.query.apiKey;
      if (apiKey) {
        return `apiKey:${apiKey}`;
      }

      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "unknown-ip";
      return `ip:${ip}`;
    },
    handler: (req: Request, res: Response) => {
      return sendResponse(
        res,
        429,
        false,
        "Too many requests. Please try again later.",
        undefined,
        {
          errors: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Rate limit threshold breached.",
            retryAfterSeconds: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000),
          },
        }
      );
    },
    standardHeaders: true, // Return standard rate limit info headers
    legacyHeaders: false,
  });
};
