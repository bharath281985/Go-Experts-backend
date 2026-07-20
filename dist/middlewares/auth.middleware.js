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
        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (decoded.type === "portal") {
            const user = await prisma.user.findFirst({
                where: { id: decoded.id, deletedAt: null },
            });
            if (!user || String(user.status).toLowerCase() !== "active") {
                return res.status(403).json({ success: false, message: "User suspended or deactivated" });
            }
            req.user = {
                id: user.id,
                email: user.email,
                role: user.role,
                type: "portal",
            };
            return next();
        }
        const admin = await prisma.adminUser.findUnique({
            where: { id: decoded.id },
            include: { role: true },
        });
        if (admin && admin.status === "active") {
            req.user = {
                id: admin.id,
                email: admin.email,
                role: admin.role.name,
                type: "admin",
            };
            return next();
        }
        // Fallback for tokens without type (or if admin lookup missed)
        const user = await prisma.user.findFirst({
            where: { id: decoded.id, deletedAt: null },
        });
        if (user && String(user.status).toLowerCase() === "active") {
            req.user = {
                id: user.id,
                email: user.email,
                role: user.role,
                type: "portal",
            };
            return next();
        }
        return res.status(403).json({ success: false, message: "User suspended or deactivated" });
    }
    catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Token Expired" });
        }
        return res.status(401).json({ success: false, message: "Invalid Access Token" });
    }
};
