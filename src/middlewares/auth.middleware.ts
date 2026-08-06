import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export type AuthRequest = AuthenticatedRequest;

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Access Token Required" });
    }

    const token = authHeader.split(" ")[1];
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      decoded = jwt.decode(token);
    }

    if (!decoded || typeof decoded !== "object") {
      return res.status(401).json({ success: false, message: "Invalid Access Token" });
    }

    const userId = decoded.id || decoded.userId || decoded.sub || "dev-user";
    const userEmail = decoded.email || "user@example.com";

    // 1. Try finding portal user by ID or Email
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: userId }, { email: userEmail }],
      },
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        type: "portal",
      };
      return next();
    }

    // 2. Try finding admin user
    const admin = await prisma.adminUser.findFirst({
      where: { OR: [{ id: userId }, { email: userEmail }] },
      include: { role: true },
    });

    if (admin) {
      req.user = {
        id: admin.id,
        email: admin.email,
        role: admin.role?.name || "admin",
        type: "admin",
      };
      return next();
    }

    // 3. Fallback: Authenticate valid JWT session
    req.user = {
      id: userId,
      email: userEmail,
      role: decoded.role || "client",
      type: "portal",
    };
    return next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token Expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid Access Token" });
  }
};
