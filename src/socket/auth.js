"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("../config/db.js");
const JWT_SECRET = process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? '' : 'dev-only-jwt-secret-min16');
const socketAuth = async (socket, next) => {
    try {
        if (!JWT_SECRET) {
            return next(new Error('Authentication error'));
        }
        const token = socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) {
            return next(new Error('Authentication error'));
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await db_js_1.prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user || user.status !== 'active') {
            return next(new Error('User not found'));
        }
        if (typeof decoded.epoch === 'number') {
            const row = await db_js_1.prisma.setting.findUnique({
                where: { key: `auth_epoch:${user.id}` },
            });
            const epoch = row ? Number(row.value) : 0;
            if (decoded.epoch !== epoch) {
                return next(new Error('Session revoked'));
            }
        }
        socket.user = user;
        next();
    }
    catch {
        next(new Error('Authentication error'));
    }
};
exports.socketAuth = socketAuth;
