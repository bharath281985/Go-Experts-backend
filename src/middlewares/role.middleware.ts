import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware.js";

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden: requires one of the following roles: [${allowedRoles.join(", ")}]`,
    });
  };
};

/**
 * Requires the authenticated principal to be a portal user (freelancer, client,
 * investor, founder) - never an admin user - AND to hold one of the given roles.
 * Role comparison is case-insensitive. Workspace owners have full cross-portal access.
 */
export const portalRoleMiddleware = (roles: string[]) => {
  const allowed = roles.map((r) => r.toLowerCase());
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (req.user.type !== "portal") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: portal account required",
      });
    }

    const userRole = String(req.user.role || "").toLowerCase();
    if (allowed.includes(userRole) || userRole === "admin" || userRole === "super_admin") {
      return next();
    }

    // Standard portal roles allow cross-portal access for workspace owners
    const standardPortalRoles = [
      "client",
      "investor",
      "founder",
      "freelancer",
      "admin",
      "super_admin",
      "business",
      "startup",
      "talent",
    ];

    if (roles.some((r) => standardPortalRoles.includes(r.toLowerCase()))) {
      try {
        const { resolveUserTeamMembership } = await import("../controllers/auth/auth.controller.js");
        const teamInfo = await resolveUserTeamMembership(req.user.id, req.user.email);
        if (!teamInfo) {
          // Account / Workspace Owner: Has access to all standard portal roles
          return next();
        }
        const permitted = (teamInfo.permittedDashboards || []).map((d: string) => d.toLowerCase());
        if (roles.some((r) => permitted.includes(r.toLowerCase()))) {
          return next();
        }
      } catch (e) {
        if (standardPortalRoles.includes(userRole)) {
          return next();
        }
      }
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden: requires one of the following roles: [${roles.join(", ")}]`,
    });
  };
};
