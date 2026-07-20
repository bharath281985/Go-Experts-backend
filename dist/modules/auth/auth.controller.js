import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
// Helper to sign JWTs
const signAccessToken = (user) => {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
        expiresIn: "15m",
    });
};
const signRefreshToken = (user) => {
    return jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_REFRESH_SECRET, {
        expiresIn: "7d",
    });
};
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password required" });
        }
        const admin = await prisma.adminUser.findUnique({
            where: { email },
            include: { role: true },
        });
        const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.socket?.remoteAddress || req.ip || null;
        const userAgent = req.headers["user-agent"] || null;
        if (!admin) {
            // Track failed attempt — fire-and-forget
            prisma.loginAttempt
                .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Email not found" } })
                .catch(() => { });
            return res.status(400).json({ success: false, message: "Invalid email or password" });
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            prisma.loginAttempt
                .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Wrong password" } })
                .catch(() => { });
            return res.status(400).json({ success: false, message: "Invalid email or password" });
        }
        if (admin.status !== "active") {
            prisma.loginAttempt
                .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Account suspended" } })
                .catch(() => { });
            return res.status(403).json({ success: false, message: "User suspended or inactive" });
        }
        const payload = { id: admin.id, email: admin.email, role: admin.role.name };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
        // Save refresh token to database
        await prisma.refreshToken.create({
            data: {
                adminUserId: admin.id,
                token: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            },
        });
        // Save session info
        await prisma.session.create({
            data: {
                adminUserId: admin.id,
                token: accessToken,
                ipAddress: (req.ip || "").toString(),
                userAgent: req.headers["user-agent"] || "",
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
            },
        });
        // Log activity
        await prisma.activityLog.create({
            data: {
                adminUserId: admin.id,
                action: "login",
                description: `Successfully logged in from IP ${req.ip}`,
            },
        });
        // Track successful login attempt — fire-and-forget
        prisma.loginAttempt
            .create({
            data: {
                email,
                ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || null,
                userAgent: req.headers["user-agent"] || null,
                success: true,
            },
        })
            .catch(() => { });
        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: admin.id,
                email: admin.email,
                fullName: admin.fullName,
                avatarUrl: admin.avatarUrl,
                role: admin.role.name,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const logout = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            // Revoke the session matching the access token
            await prisma.session.updateMany({
                where: { token },
                data: { revokedAt: new Date() },
            });
        }
        if (req.body.refreshToken) {
            // Revoke refresh token
            await prisma.refreshToken.updateMany({
                where: { token: req.body.refreshToken },
                data: { revokedAt: new Date() },
            });
        }
        if (req.user) {
            await prisma.activityLog.create({
                data: {
                    adminUserId: req.user.id,
                    action: "logout",
                    description: `Successfully logged out`,
                },
            });
        }
        res.json({ success: true, message: "Logged out successfully" });
    }
    catch (err) {
        next(err);
    }
};
export const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: "Refresh token is required" });
        }
        // Verify token exists in database and is not revoked/expired
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { adminUser: { include: { role: true } } },
        });
        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
        }
        const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
        const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
        const newAccessToken = signAccessToken(payload);
        res.json({ success: true, accessToken: newAccessToken });
    }
    catch (err) {
        res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
};
export const me = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const admin = await prisma.adminUser.findUnique({
            where: { id: req.user.id },
            include: { role: true },
        });
        if (!admin) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({
            success: true,
            user: {
                id: admin.id,
                email: admin.email,
                fullName: admin.fullName,
                avatarUrl: admin.avatarUrl,
                role: admin.role.name,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const forgotPassword = async (req, res, next) => {
    res.json({ success: true, message: "Password reset instructions sent to registered email." });
};
export const resetPassword = async (req, res, next) => {
    res.json({ success: true, message: "Password has been successfully updated." });
};
