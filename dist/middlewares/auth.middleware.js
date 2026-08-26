import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Access Token Required" });
        }
        const token = authHeader.split(" ")[1];
        let decoded;
        try {
            decoded = jwt.verify(token, env.JWT_SECRET);
        }
        catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ success: false, message: "Token Expired" });
            }
            return res.status(401).json({ success: false, message: "Invalid Access Token" });
        }
        if (!decoded || typeof decoded !== "object") {
            return res.status(401).json({ success: false, message: "Invalid Access Token payload" });
        }
        // `purpose` check: ensure registration tokens cannot be used as access tokens
        if (decoded.purpose === "SOCIAL_REGISTRATION") {
            return res.status(401).json({ success: false, message: "Registration token cannot be used for API access" });
        }
        const userId = decoded.id || decoded.userId || decoded.sub;
        const userEmail = decoded.email;
        const tokenType = decoded.type; // "admin" or "portal" or undefined
        if (!userId && !userEmail) {
            return res.status(401).json({ success: false, message: "Invalid token payload" });
        }
        // If token is explicitly for admin, check adminUser table FIRST
        if (tokenType === "admin") {
            const admin = await prisma.adminUser.findFirst({
                where: { OR: [{ id: userId }, { email: userEmail }] },
                include: { role: true },
            });
            if (admin) {
                if (admin.status !== "active") {
                    return res.status(403).json({ success: false, message: "Admin account deactivated." });
                }
                req.user = {
                    id: admin.id,
                    email: admin.email,
                    role: admin.role?.name || "admin",
                    type: "admin",
                };
                return next();
            }
            return res.status(401).json({ success: false, message: "Admin user not found" });
        }
        // 1. Try finding portal user by ID or Email
        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
                OR: [{ id: userId }, { email: userEmail }],
            },
        });
        if (user) {
            // Account Status Guard
            if (user.status === "SUSPENDED") {
                return res.status(403).json({ success: false, message: "Account suspended." });
            }
            if (user.status === "BLOCKED" || user.status === "DELETED") {
                return res.status(403).json({ success: false, message: "Account unavailable." });
            }
            req.user = {
                id: user.id,
                email: user.email,
                role: user.role, // from DB!
                onboardingStatus: user.onboardingStatus, // from DB!
                currentStep: user.currentStep, // from DB!
                type: "portal",
            };
            return next();
        }
        // 2. Fallback: Try finding admin user (for tokens without explicit type)
        const admin = await prisma.adminUser.findFirst({
            where: { OR: [{ id: userId }, { email: userEmail }] },
            include: { role: true },
        });
        if (admin) {
            if (admin.status !== "active") {
                return res.status(403).json({ success: false, message: "Admin account deactivated." });
            }
            req.user = {
                id: admin.id,
                email: admin.email,
                role: admin.role?.name || "admin",
                type: "admin",
            };
            return next();
        }
        return res.status(401).json({ success: false, message: "User not found" });
    }
    catch (error) {
        console.error("Auth Middleware Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error during authentication" });
    }
};
