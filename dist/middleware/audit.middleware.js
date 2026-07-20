import { prisma } from "../config/database.js";
// Fields to never log (security)
const SENSITIVE_FIELDS = ["password", "token", "refreshToken", "secret", "apiKey"];
function sanitize(obj) {
    if (!obj || typeof obj !== "object")
        return obj;
    const clean = { ...obj };
    SENSITIVE_FIELDS.forEach((f) => delete clean[f]);
    return clean;
}
function computeDiff(oldObj, newObj) {
    const diff = {};
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    for (const key of allKeys) {
        if (SENSITIVE_FIELDS.includes(key))
            continue;
        const oldVal = oldObj?.[key];
        const newVal = newObj?.[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            diff[key] = { from: oldVal ?? null, to: newVal ?? null };
        }
    }
    return diff;
}
/**
 * Audit Middleware Factory
 * Captures: Who (actorId), What (entity + entityId), When (createdAt),
 * Old Value (snapshot before), New Value (snapshot after), and a field-level diff.
 */
export const auditMiddleware = (action, entity) => {
    return async (req, res, next) => {
        let oldValue = null;
        const entityId = req.params.id || null;
        // For UPDATE and DELETE: fetch the existing record BEFORE mutation
        if (["PUT", "PATCH", "DELETE"].includes(req.method) && entityId) {
            try {
                const db = prisma[entity.toLowerCase()];
                if (db?.findUnique) {
                    const existing = await db.findUnique({ where: { id: entityId } });
                    oldValue = sanitize(existing);
                }
            }
            catch {
                // Non-critical: if we can't fetch the old record, proceed without it
            }
        }
        // Hook into response finish to capture the new state
        res.on("finish", async () => {
            try {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const actorId = req.user?.id || null;
                    const ipAddress = (req.ip || req.socket?.remoteAddress || "").toString();
                    const userAgent = req.headers["user-agent"] || "";
                    // Build newValue from request body for mutations
                    let newValue = null;
                    if (["POST", "PUT", "PATCH"].includes(req.method)) {
                        newValue = sanitize(req.body);
                    }
                    // Compute field-level diff between old and new
                    const diffMap = computeDiff(oldValue, newValue);
                    const hasDiff = Object.keys(diffMap).length > 0;
                    await prisma.auditLog.create({
                        data: {
                            actorId,
                            action: req.method === "DELETE" ? "delete"
                                : req.method === "POST" ? "create"
                                    : req.method === "PATCH" ? "status_change"
                                        : action,
                            entity,
                            entityId,
                            oldValue: oldValue ? JSON.stringify(oldValue) : null,
                            newValue: newValue ? JSON.stringify(newValue) : null,
                            diff: hasDiff ? JSON.stringify(diffMap) : null,
                            ipAddress,
                            userAgent,
                        },
                    });
                }
            }
            catch (err) {
                console.error("❌ Audit Logging Error:", err);
            }
        });
        next();
    };
};
