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
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
      type?: "admin" | "portal";
    };

    if (decoded.type === "portal") {
      const user = await prisma.user.findFirst({
        where: { id: decoded.id, deletedAt: null },
      });
      if (!user || !["active", "pending", "inactive"].includes(String(user.status).toLowerCase())) {
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
    if (user && ["active", "pending", "inactive"].includes(String(user.status).toLowerCase())) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        type: "portal",
      };
      return next();
    }

    return res.status(403).json({ success: false, message: "User suspended or deactivated" });
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token Expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid Access Token" });
  }
};
