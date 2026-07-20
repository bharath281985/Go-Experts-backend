export const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
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
 * Role comparison is case-insensitive.
 */
export const portalRoleMiddleware = (roles) => {
    const allowed = roles.map((r) => r.toLowerCase());
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (req.user.type !== "portal") {
            return res.status(403).json({
                success: false,
                message: "Forbidden: portal account required",
            });
        }
        if (allowed.includes(String(req.user.role || "").toLowerCase())) {
            return next();
        }
        return res.status(403).json({
            success: false,
            message: `Forbidden: requires one of the following roles: [${roles.join(", ")}]`,
        });
    };
};
