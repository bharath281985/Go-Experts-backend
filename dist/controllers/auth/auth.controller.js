import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { SmsChannelAdapter } from "../../modules/notifications/notification.service.js";
const PORTAL_ROLES = new Set(["freelancer", "client", "investor", "founder"]);
const signAccessToken = (user) => {
    return jwt.sign({ id: user.id, email: user.email, role: user.role, type: user.type ?? "admin" }, env.JWT_SECRET, { expiresIn: "15m" });
};
const signRefreshToken = (user) => {
    return jwt.sign({ id: user.id, email: user.email, role: user.role, type: user.type ?? "admin" }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};
function normalizePortalRole(role) {
    const value = String(role || "").trim().toLowerCase();
    if (value === "client / business" || value === "business")
        return "client";
    if (value === "startup founder")
        return "founder";
    return value;
}
async function verifyPassword(password, storedHash) {
    if (!storedHash)
        return false;
    // bcrypt hashes start with $2a$ / $2b$ / $2y$
    if (storedHash.startsWith("$2")) {
        try {
            return await bcrypt.compare(password, storedHash);
        }
        catch {
            return false;
        }
    }
    // Legacy plain-text passwords (migrate on successful login if needed)
    return password === storedHash;
}
function clientMeta(req) {
    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
        || req.socket?.remoteAddress
        || req.ip
        || null;
    const userAgent = req.headers["user-agent"] || null;
    return { ipAddress, userAgent };
}
export const login = async (req, res, next) => {
    try {
        const rawEmail = String(req.body?.email || "").trim();
        const email = rawEmail.toLowerCase();
        const password = String(req.body?.password || "");
        if (!rawEmail || !password) {
            return res.status(400).json({ success: false, message: "Email and password required" });
        }
        const { ipAddress, userAgent } = clientMeta(req);
        // 1) Super Admin users
        const admin = await prisma.adminUser.findFirst({
            where: {
                OR: [{ email: rawEmail }, { email }],
            },
            include: { role: true },
        });
        if (admin) {
            const isMatch = await verifyPassword(password, admin.password);
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
            const payload = {
                id: admin.id,
                email: admin.email,
                role: admin.role.name,
                type: "admin",
            };
            const accessToken = signAccessToken(payload);
            const refreshToken = signRefreshToken(payload);
            await prisma.refreshToken.create({
                data: {
                    adminUserId: admin.id,
                    token: refreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
            });
            await prisma.session.create({
                data: {
                    adminUserId: admin.id,
                    token: accessToken,
                    ipAddress: (req.ip || "").toString(),
                    userAgent: req.headers["user-agent"] || "",
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            });
            await prisma.activityLog.create({
                data: {
                    adminUserId: admin.id,
                    action: "login",
                    description: `Successfully logged in from IP ${req.ip}`,
                },
            });
            prisma.loginAttempt
                .create({ data: { email, ipAddress, userAgent, success: true } })
                .catch(() => { });
            return res.json({
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
        // 2) Public website users (freelancer / client / investor / founder)
        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
                OR: [{ email: rawEmail }, { email }],
            },
        });
        if (!user) {
            prisma.loginAttempt
                .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Email not found" } })
                .catch(() => { });
            return res.status(400).json({ success: false, message: "Invalid email or password" });
        }
        const isMatch = await verifyPassword(password, user.password);
        if (!isMatch) {
            prisma.loginAttempt
                .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Wrong password" } })
                .catch(() => { });
            return res.status(400).json({ success: false, message: "Invalid email or password" });
        }
        // Upgrade legacy plain-text passwords to bcrypt after a successful login
        if (user.password && !user.password.startsWith("$2")) {
            const hashed = await bcrypt.hash(password, 10);
            await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
        }
        if (String(user.status).toLowerCase() !== "active") {
            prisma.loginAttempt
                .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Account suspended" } })
                .catch(() => { });
            return res.status(403).json({ success: false, message: "User suspended or inactive" });
        }
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            type: "portal",
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
        prisma.loginAttempt
            .create({ data: { email, ipAddress, userAgent, success: true } })
            .catch(() => { });
        return res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                role: user.role,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const register = async (req, res, next) => {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const password = String(req.body?.password || "");
        const fullName = String(req.body?.fullName || req.body?.name || "").trim();
        const role = normalizePortalRole(req.body?.role);
        if (!email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: "fullName, email and password are required",
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters.",
            });
        }
        if (!PORTAL_ROLES.has(role)) {
            return res.status(400).json({
                success: false,
                message: "role must be freelancer, client, investor, or founder",
            });
        }
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && !existing.deletedAt) {
            return res.status(409).json({
                success: false,
                message: "A user with this email already exists. Please use a different email address.",
            });
        }
        const hashed = await bcrypt.hash(password, 10);
        const phone = req.body?.phone ? String(req.body.phone) : null;
        const country = req.body?.country ? String(req.body.country) : null;
        const city = req.body?.city ? String(req.body.city) : null;
        const bio = req.body?.bio ? String(req.body.bio) : null;
        const user = await prisma.$transaction(async (tx) => {
            const created = existing
                ? await tx.user.update({
                    where: { id: existing.id },
                    data: {
                        password: hashed,
                        fullName,
                        role,
                        status: "active",
                        deletedAt: null,
                        phone,
                        country,
                        city,
                        bio,
                    },
                })
                : await tx.user.create({
                    data: {
                        email,
                        password: hashed,
                        fullName,
                        role,
                        status: "active",
                        phone,
                        country,
                        city,
                        bio,
                    },
                });
            if (role === "freelancer") {
                const skills = Array.isArray(req.body?.skills)
                    ? req.body.skills.join(", ")
                    : (req.body?.skills ? String(req.body.skills) : null);
                const hourlyRate = Number(req.body?.hourlyRate);
                await tx.freelancerProfile.upsert({
                    where: { userId: created.id },
                    create: {
                        userId: created.id,
                        industry: req.body?.industry || req.body?.category || null,
                        skills,
                        hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
                        experience: req.body?.experience ? String(req.body.experience) : null,
                    },
                    update: {
                        industry: req.body?.industry || req.body?.category || null,
                        skills,
                        hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
                        experience: req.body?.experience ? String(req.body.experience) : null,
                    },
                });
            }
            if (role === "client") {
                await tx.clientProfile.upsert({
                    where: { userId: created.id },
                    create: {
                        userId: created.id,
                        company: req.body?.company ? String(req.body.company) : null,
                        industry: req.body?.industry || req.body?.category || null,
                    },
                    update: {
                        company: req.body?.company ? String(req.body.company) : null,
                        industry: req.body?.industry || req.body?.category || null,
                    },
                });
            }
            if (role === "investor") {
                const ticketMin = Number(req.body?.ticketMin);
                const ticketMax = Number(req.body?.ticketMax);
                await tx.investorProfile.upsert({
                    where: { userId: created.id },
                    create: {
                        userId: created.id,
                        firm: req.body?.firm ? String(req.body.firm) : null,
                        ticketMin: Number.isFinite(ticketMin) ? ticketMin : null,
                        ticketMax: Number.isFinite(ticketMax) ? ticketMax : null,
                        focusAreas: req.body?.focusAreas ? String(req.body.focusAreas) : null,
                    },
                    update: {
                        firm: req.body?.firm ? String(req.body.firm) : null,
                        ticketMin: Number.isFinite(ticketMin) ? ticketMin : null,
                        ticketMax: Number.isFinite(ticketMax) ? ticketMax : null,
                        focusAreas: req.body?.focusAreas ? String(req.body.focusAreas) : null,
                    },
                });
            }
            if (role === "founder") {
                await tx.founderProfile.upsert({
                    where: { userId: created.id },
                    create: {
                        userId: created.id,
                        startupName: req.body?.startupName || req.body?.startup || null,
                        industry: req.body?.industry || req.body?.category || null,
                        stage: req.body?.stage ? String(req.body.stage) : null,
                    },
                    update: {
                        startupName: req.body?.startupName || req.body?.startup || null,
                        industry: req.body?.industry || req.body?.category || null,
                        stage: req.body?.stage ? String(req.body.stage) : null,
                    },
                });
            }
            return created;
        });
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            type: "portal",
        };
        const accessToken = signAccessToken(payload);
        const refreshToken = signRefreshToken(payload);
        return res.status(201).json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                role: user.role,
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
            await prisma.session.updateMany({
                where: { token },
                data: { revokedAt: new Date() },
            });
        }
        if (req.body.refreshToken) {
            await prisma.refreshToken.updateMany({
                where: { token: req.body.refreshToken },
                data: { revokedAt: new Date() },
            });
        }
        if (req.user?.type === "admin") {
            await prisma.activityLog.create({
                data: {
                    adminUserId: req.user.id,
                    action: "logout",
                    description: "Successfully logged out",
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
        // Admin refresh tokens are stored in DB
        const storedToken = await prisma.refreshToken.findFirst({
            where: { token: refreshToken },
            include: { adminUser: { include: { role: true } } },
        });
        if (storedToken && !storedToken.revokedAt && storedToken.expiresAt >= new Date()) {
            const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
            const payload = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                type: "admin",
            };
            return res.json({ success: true, accessToken: signAccessToken(payload) });
        }
        // Portal refresh tokens are JWT-only
        try {
            const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
            if (decoded.type === "portal" || !storedToken) {
                const user = await prisma.user.findFirst({
                    where: { id: decoded.id, deletedAt: null },
                });
                if (!user || String(user.status).toLowerCase() !== "active") {
                    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
                }
                const payload = {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    type: "portal",
                };
                return res.json({ success: true, accessToken: signAccessToken(payload) });
            }
        }
        catch {
            // fall through
        }
        return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
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
        if (req.user.type === "portal") {
            const user = await prisma.user.findFirst({
                where: { id: req.user.id, deletedAt: null },
            });
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.fullName,
                    avatarUrl: user.avatarUrl,
                    role: user.role,
                },
            });
        }
        const admin = await prisma.adminUser.findUnique({
            where: { id: req.user.id },
            include: { role: true },
        });
        if (!admin) {
            // Fallback for older tokens without type claim
            const user = await prisma.user.findFirst({
                where: { id: req.user.id, deletedAt: null },
            });
            if (user) {
                return res.json({
                    success: true,
                    user: {
                        id: user.id,
                        email: user.email,
                        fullName: user.fullName,
                        avatarUrl: user.avatarUrl,
                        role: user.role,
                    },
                });
            }
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
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        // Always return the same message to avoid account enumeration
        const okMessage = "If an account exists for that email, password reset instructions have been sent.";
        const admin = await prisma.adminUser.findFirst({
            where: { OR: [{ email }, { email: String(req.body?.email || "").trim() }] },
        });
        const portalUser = !admin
            ? await prisma.user.findFirst({ where: { email, deletedAt: null } })
            : null;
        if (!admin && !portalUser) {
            return res.json({ success: true, message: okMessage });
        }
        const subject = admin
            ? { id: admin.id, email: admin.email, type: "admin" }
            : { id: portalUser.id, email: portalUser.email, type: "portal" };
        const resetToken = jwt.sign({ id: subject.id, email: subject.email, type: subject.type, purpose: "password_reset" }, env.JWT_SECRET, { expiresIn: "1h" });
        const settingKey = `password_reset:${subject.type}:${subject.id}`;
        await prisma.setting.upsert({
            where: { key: settingKey },
            update: { value: resetToken, category: "security" },
            create: { key: settingKey, value: resetToken, category: "security" },
        });
        const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
        console.log(`[password-reset] ${subject.email} → ${resetUrl}`);
        // Attempt email if SMTP channel exists; never fail the request on mail errors
        try {
            const nodemailer = await import("nodemailer");
            const channel = await prisma.communicationChannel.findFirst({
                where: { name: "email", status: "active" },
            });
            const config = channel?.config ? JSON.parse(channel.config) : null;
            if (config?.host && config?.user) {
                const transporter = nodemailer.createTransport({
                    host: config.host,
                    port: Number(config.port) || 587,
                    secure: Boolean(config.secure),
                    auth: { user: config.user, pass: config.pass || config.password },
                });
                await transporter.sendMail({
                    from: config.from || config.user,
                    to: subject.email,
                    subject: "Go Experts — Password Reset",
                    text: `Reset your password using this link (valid 1 hour):\n\n${resetUrl}\n`,
                    html: `<p>Reset your password using this link (valid 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
                });
            }
        }
        catch (mailErr) {
            console.warn("[password-reset] email send skipped/failed:", mailErr);
        }
        const payload = { success: true, message: okMessage };
        if (env.NODE_ENV !== "production") {
            payload.resetToken = resetToken;
            payload.resetUrl = resetUrl;
        }
        return res.json(payload);
    }
    catch (err) {
        next(err);
    }
};
export const resetPassword = async (req, res, next) => {
    try {
        const token = String(req.body?.token || req.body?.resetToken || "").trim();
        const password = String(req.body?.password || req.body?.newPassword || "");
        if (!token || !password) {
            return res.status(400).json({ success: false, message: "Token and new password are required" });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
        }
        let decoded;
        try {
            decoded = jwt.verify(token, env.JWT_SECRET);
        }
        catch {
            return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
        }
        if (decoded.purpose !== "password_reset") {
            return res.status(400).json({ success: false, message: "Invalid reset token" });
        }
        const accountType = decoded.type === "admin" ? "admin" : "portal";
        const settingKey = `password_reset:${accountType}:${decoded.id}`;
        const stored = await prisma.setting.findUnique({ where: { key: settingKey } });
        if (!stored || stored.value !== token) {
            return res.status(400).json({ success: false, message: "Reset token already used or invalid" });
        }
        const hashed = await bcrypt.hash(password, 10);
        if (accountType === "admin") {
            const admin = await prisma.adminUser.findUnique({ where: { id: decoded.id } });
            if (!admin) {
                return res.status(404).json({ success: false, message: "Account not found" });
            }
            await prisma.adminUser.update({ where: { id: admin.id }, data: { password: hashed } });
        }
        else {
            const user = await prisma.user.findFirst({ where: { id: decoded.id, deletedAt: null } });
            if (!user) {
                return res.status(404).json({ success: false, message: "Account not found" });
            }
            await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
        }
        await prisma.setting.delete({ where: { key: settingKey } }).catch(() => { });
        return res.json({ success: true, message: "Password has been successfully updated." });
    }
    catch (err) {
        next(err);
    }
};
export const changePassword = async (req, res, next) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const currentPassword = String(req.body?.currentPassword || req.body?.oldPassword || "");
        const newPassword = String(req.body?.newPassword || req.body?.password || "");
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: "Current password and new password are required" });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        if (req.user.type === "portal") {
            const user = await prisma.user.findFirst({ where: { id: req.user.id, deletedAt: null } });
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            const ok = await verifyPassword(currentPassword, user.password);
            if (!ok) {
                return res.status(400).json({ success: false, message: "Current password is incorrect" });
            }
            await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
        }
        else {
            const admin = await prisma.adminUser.findUnique({ where: { id: req.user.id } });
            if (!admin) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            const ok = await verifyPassword(currentPassword, admin.password);
            if (!ok) {
                return res.status(400).json({ success: false, message: "Current password is incorrect" });
            }
            await prisma.adminUser.update({ where: { id: admin.id }, data: { password: hashed } });
        }
        return res.json({ success: true, message: "Password updated successfully." });
    }
    catch (err) {
        next(err);
    }
};
export const sendOtp = async (req, res, next) => {
    try {
        const mobile = String(req.body?.mobile || "").trim();
        if (!mobile) {
            return res.status(400).json({ success: false, message: "Mobile number is required" });
        }
        const otp = req.body?.otp || Math.floor(100000 + Math.random() * 900000).toString();
        const chanConfig = await prisma.communicationChannel.findUnique({
            where: { name: "sms" },
        });
        const parsedConfig = chanConfig && chanConfig.config ? JSON.parse(chanConfig.config) : {};
        const smsAdapter = new SmsChannelAdapter();
        const response = await smsAdapter.send({
            to: mobile,
            body: `Your Go Experts verification code is: ${otp}. Do not share this with anyone.`,
        }, parsedConfig);
        if (response.status === "failed") {
            return res.status(500).json({ success: false, message: response.errorMessage || "Failed to send OTP" });
        }
        // In a real production app, we would store the OTP in a Redis cache instead of returning it.
        // We return it here so the frontend can mock verify it.
        return res.json({ success: true, message: "OTP sent successfully", otp });
    }
    catch (err) {
        next(err);
    }
};
