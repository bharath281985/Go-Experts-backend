"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditEngine = void 0;
class AuditEngine {
    /**
     * Log an audit event. Used for tracking compliance, strict security events,
     * and administrative/user actions that modify critical state.
     */
    static async track(userId, action, entity, entityId = null, oldValue = null, newValue = null, req) {
        try {
            const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;
            const browser = req ? req.headers['user-agent'] : null;
            const device = req ? req.headers['x-device-id'] : null;
            // The current Prisma schema does not expose the old audit tables that some
            // legacy modules still expect. Keep the API bootable by degrading this to
            // structured server logging until the audit schema is aligned again.
            console.log('[Audit]', {
                userId,
                action,
                entity,
                entityId,
                ip,
                browser,
                device,
                oldValue,
                newValue,
            });
        }
        catch (error) {
            console.error('AuditEngine failed to track event:', error);
        }
    }
}
exports.AuditEngine = AuditEngine;
