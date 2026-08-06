import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware.js";
import { prisma } from "../config/database.js";

// Fields to never log (security)
const SENSITIVE_FIELDS = ["password", "token", "refreshToken", "secret", "apiKey"];
const AUDIT_VALUE_LIMIT = 3000;

function sanitize(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  const clean: any = { ...obj };
  SENSITIVE_FIELDS.forEach((f) => delete clean[f]);
  return clean;
}

function computeDiff(oldObj: any, newObj: any): Record<string, { from: any; to: any }> {
  const diff: Record<string, { from: any; to: any }> = {};
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
  for (const key of allKeys) {
    if (SENSITIVE_FIELDS.includes(key)) continue;
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { from: oldVal ?? null, to: newVal ?? null };
    }
  }
  return diff;
}

function toAuditValue(value: any): string | null {
  if (value == null) return null;

  const text = JSON.stringify(value);
  if (text.length <= AUDIT_VALUE_LIMIT) return text;

  return JSON.stringify({
    truncated: true,
    originalLength: text.length,
    preview: text.slice(0, AUDIT_VALUE_LIMIT - 60),
  });
}

/**
 * Audit Middleware Factory
 * Captures: Who (actorId), What (entity + entityId), When (createdAt),
 * Old Value (snapshot before), New Value (snapshot after), and a field-level diff.
 */
export const auditMiddleware = (action: string, entity: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    
    let oldValue: any = null;
    const entityId = req.params.id || null;

    // For UPDATE and DELETE: fetch the existing record BEFORE mutation
    if (["PUT", "PATCH", "DELETE"].includes(req.method) && entityId) {
      try {
        const db = (prisma as any)[entity.toLowerCase()];
        if (db?.findUnique) {
          const existing = await db.findUnique({ where: { id: entityId } });
          oldValue = sanitize(existing);
        }
      } catch {
        // Non-critical: if we can't fetch the old record, proceed without it
      }
    }

    // Hook into response finish to capture the new state
    res.on("finish", async () => {
      try {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let actorId = req.user?.id || null;
          if (actorId) {
            const adminExists = await prisma.adminUser.findUnique({ where: { id: actorId }, select: { id: true } }).catch(() => null);
            if (!adminExists) {
              const defaultAdmin = await prisma.adminUser.findFirst({ select: { id: true } }).catch(() => null);
              actorId = defaultAdmin?.id || null;
            }
          }
          const ipAddress = (req.ip || req.socket?.remoteAddress || "").toString();
          const userAgent = req.headers["user-agent"] || "";

          // Build newValue from request body for mutations
          let newValue: any = null;
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
                    : req.method === "POST"   ? "create"
                    : req.method === "PATCH"  ? "status_change"
                    : action,
              entity,
              entityId,
              oldValue:  toAuditValue(oldValue),
              newValue:  toAuditValue(newValue),
              diff:      hasDiff ? toAuditValue(diffMap) : null,
              ipAddress,
              userAgent,
            },
          });
        }
      } catch (err) {
        console.error("❌ Audit Logging Error:", err);
      }
    });

    next();
  };
};
