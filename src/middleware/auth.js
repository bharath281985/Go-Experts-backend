"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRole = exports.authenticateOptional = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../config/db.js");
const response_js_1 = require("../core/response.js");
const JWT_SECRET = process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'dev-only-jwt-secret-min16');
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set in production');
}
const authEpochKey = (userId) => `auth_epoch:${userId}`;
const getAuthEpoch = async (userId) => {
    const row = await db_js_1.prisma.setting.findUnique({ where: { key: authEpochKey(userId) } });
    const n = row ? Number(row.value) : 0;
    return Number.isFinite(n) ? n : 0;
};
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json((0, response_js_1.errorResponse)('Invalid session. Please login again.', 'INVALID_TOKEN'));
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await db_js_1.prisma.user.findUnique({
            where: { id: decoded.id },
        });
        if (!user) {
            return res.status(401).json((0, response_js_1.errorResponse)('Invalid session. Please login again.', 'INVALID_TOKEN'));
        }
        if (user.status !== 'active') {
            return res.status(403).json((0, response_js_1.errorResponse)('Your account is inactive. Please contact support.', 'ACCOUNT_INACTIVE'));
        }
        // if (typeof decoded.epoch === 'number') {
        //     const epoch = await getAuthEpoch(user.id);
        //     if (decoded.epoch !== epoch) {
        //         return res.status(401).json((0, response_js_1.errorResponse)('Session revoked. Please login again.', 'SESSION_REVOKED'));
        //     }
        // }
        req.user = user;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json((0, response_js_1.errorResponse)('Session expired. Please login again.', 'TOKEN_EXPIRED'));
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json((0, response_js_1.errorResponse)('Invalid session. Please login again.', 'INVALID_TOKEN'));
        }
        console.error('[Auth middleware]', error);
        return res.status(401).json((0, response_js_1.errorResponse)('Invalid session. Please login again.', 'INVALID_TOKEN'));
    }
};
exports.authenticate = authenticate;
const authenticateOptional = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        const token = authHeader.split(' ')[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await db_js_1.prisma.user.findUnique({
            where: { id: decoded.id },
        });
        if (user && user.status === 'active') {
            // if (typeof decoded.epoch === 'number') {
            //     const epoch = await getAuthEpoch(user.id);
            //     if (decoded.epoch !== epoch)
            //         return next();
            // }
            req.user = user;
        }
        return next();
    }
    catch {
        return next();
    }
};
exports.authenticateOptional = authenticateOptional;
const authorizeRole = (roles) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        if (!req.user || !allowed.includes(req.user.role)) {
            return res.status(403).json((0, response_js_1.errorResponse)('You do not have permission to access this resource.', 'FORBIDDEN'));
        }
        next();
    };
};
exports.authorizeRole = authorizeRole;
