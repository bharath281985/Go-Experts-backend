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
        const admin = await prisma.adminUser.findUnique({
            where: { id: decoded.id },
            include: { role: true },
        });
        if (!admin || admin.status !== "active") {
            return res.status(403).json({ success: false, message: "User suspended or deactivated" });
        }
        req.user = {
            id: admin.id,
            email: admin.email,
            role: admin.role.name,
        };
        next();
    }
    catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ success: false, message: "Token Expired" });
        }
        return res.status(401).json({ success: false, message: "Invalid Access Token" });
    }
};
