import crypto from "crypto";
import { prisma } from "../../config/database.js";
import { hashApiKey } from "../../middlewares/api-key.middleware.js";
import { WebhookService } from "../../modules/developer/webhook.service.js";
import { sendResponse } from "../../common/helpers/response.helper.js";
// ============================================================
// MODULE 4: API KEY MANAGEMENT
// ============================================================
export const generateApiKey = async (req, res, next) => {
    try {
        const { name, scopes, roleMapping, expiresDays } = req.body;
        if (!name) {
            return sendResponse(res, 400, false, "API Key name is required.");
        }
        // Generate prefix-masked key: gk_live_...
        const rawKey = `gk_live_${crypto.randomBytes(24).toString("hex")}`;
        const keyHash = hashApiKey(rawKey);
        const maskedKey = `${rawKey.slice(0, 12)}...${rawKey.slice(-4)}`;
        let expiresAt = null;
        if (expiresDays) {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + parseInt(expiresDays));
        }
        const apiKey = await prisma.apiKey.create({
            data: {
                name,
                keyHash,
                maskedKey,
                scopes: scopes || "read:all",
                roleMapping: roleMapping || "admin",
                expiresAt,
            },
        });
        // Capture in Audit logs
        await prisma.auditLog.create({
            data: {
                actorId: req.user?.id || "system",
                action: "generate_api_key",
                entity: "api_keys",
                entityId: apiKey.id,
                newValue: JSON.stringify({ name, scopes, roleMapping, expiresAt }),
                ipAddress: "127.0.0.1",
            },
        });
        // Return rawKey ONLY ONCE upon creation
        return sendResponse(res, 201, true, "API Key generated successfully.", {
            ...apiKey,
            rawKey,
        });
    }
    catch (err) {
        next(err);
    }
};
export const listApiKeys = async (req, res, next) => {
    try {
        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: "desc" },
        });
        return sendResponse(res, 200, true, "API Keys listed successfully.", keys);
    }
    catch (err) {
        next(err);
    }
};
export const revokeApiKey = async (req, res, next) => {
    try {
        const { id } = req.params;
        const apiKey = await prisma.apiKey.update({
            where: { id },
            data: { status: "revoked" },
        });
        await prisma.auditLog.create({
            data: {
                actorId: req.user?.id || "system",
                action: "revoke_api_key",
                entity: "api_keys",
                entityId: id,
                newValue: JSON.stringify({ status: "revoked" }),
                ipAddress: "127.0.0.1",
            },
        });
        return sendResponse(res, 200, true, "API Key revoked successfully.", apiKey);
    }
    catch (err) {
        next(err);
    }
};
export const regenerateApiKey = async (req, res, next) => {
    try {
        const { id } = req.params;
        const existing = await prisma.apiKey.findUnique({ where: { id } });
        if (!existing) {
            return sendResponse(res, 404, false, "API Key not found.");
        }
        const rawKey = `gk_live_${crypto.randomBytes(24).toString("hex")}`;
        const keyHash = hashApiKey(rawKey);
        const maskedKey = `${rawKey.slice(0, 12)}...${rawKey.slice(-4)}`;
        const apiKey = await prisma.apiKey.update({
            where: { id },
            data: {
                keyHash,
                maskedKey,
                status: "active",
                usageCount: 0,
            },
        });
        await prisma.auditLog.create({
            data: {
                actorId: req.user?.id || "system",
                action: "regenerate_api_key",
                entity: "api_keys",
                entityId: id,
                newValue: JSON.stringify({ status: "regenerated" }),
                ipAddress: "127.0.0.1",
            },
        });
        return sendResponse(res, 200, true, "API Key regenerated successfully.", {
            ...apiKey,
            rawKey,
        });
    }
    catch (err) {
        next(err);
    }
};
// ============================================================
// MODULE 14: WEBHOOK MANAGEMENT (CRUD, Test, Replay)
// ============================================================
export const createWebhook = async (req, res, next) => {
    try {
        const { name, url, events } = req.body;
        if (!name || !url || !events || !Array.isArray(events)) {
            return sendResponse(res, 400, false, "Missing name, url, or subscription events array.");
        }
        // Auto-generate HMAC signing secret
        const secret = `whsec_${crypto.randomBytes(20).toString("hex")}`;
        const webhook = await prisma.webhook.create({
            data: {
                name,
                url,
                secret,
                events: {
                    create: events.map((e) => ({ event: e })),
                },
            },
            include: { events: true },
        });
        return sendResponse(res, 201, true, "Webhook created successfully.", webhook);
    }
    catch (err) {
        next(err);
    }
};
export const listWebhooks = async (req, res, next) => {
    try {
        const hooks = await prisma.webhook.findMany({
            include: { events: true },
            orderBy: { createdAt: "desc" },
        });
        return sendResponse(res, 200, true, "Webhooks listed successfully.", hooks);
    }
    catch (err) {
        next(err);
    }
};
export const updateWebhook = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, url, status, events } = req.body;
        // Build update parameters
        const updateData = {};
        if (name)
            updateData.name = name;
        if (url)
            updateData.url = url;
        if (status)
            updateData.status = status;
        if (events && Array.isArray(events)) {
            // Re-link events (delete old, insert new)
            await prisma.webhookEvent.deleteMany({ where: { webhookId: id } });
            updateData.events = {
                create: events.map((e) => ({ event: e })),
            };
        }
        const updated = await prisma.webhook.update({
            where: { id },
            data: updateData,
            include: { events: true },
        });
        return sendResponse(res, 200, true, "Webhook updated successfully.", updated);
    }
    catch (err) {
        next(err);
    }
};
export const deleteWebhook = async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.webhook.delete({ where: { id } });
        return sendResponse(res, 200, true, "Webhook deleted successfully.");
    }
    catch (err) {
        next(err);
    }
};
export const testWebhook = async (req, res, next) => {
    try {
        const { id } = req.params;
        const hook = await prisma.webhook.findUnique({ where: { id } });
        if (!hook) {
            return sendResponse(res, 404, false, "Webhook target not found.");
        }
        const samplePayload = {
            test: true,
            timestamp: new Date().toISOString(),
            triggeredBy: req.user?.email || "admin",
            ping: "pong",
        };
        const success = await WebhookService.dispatchWebhook(hook.id, hook.url, hook.secret, "test.ping", JSON.stringify(samplePayload));
        return sendResponse(res, success ? 200 : 502, success, success ? "Webhook verification ping sent successfully." : "Webhook ping failed to respond successfully.");
    }
    catch (err) {
        next(err);
    }
};
export const listWebhookDeliveries = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;
        const [deliveries, total] = await Promise.all([
            prisma.webhookDelivery.findMany({
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
                include: { webhook: { select: { name: true, url: true } } },
            }),
            prisma.webhookDelivery.count(),
        ]);
        return sendResponse(res, 200, true, "Webhook deliveries fetched.", deliveries, {
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const replayWebhookDelivery = async (req, res, next) => {
    try {
        const { id } = req.params;
        const success = await WebhookService.replayDelivery(id);
        return sendResponse(res, success ? 200 : 502, success, success ? "Webhook delivery replayed successfully." : "Replayed webhook response returned an error status.");
    }
    catch (err) {
        next(err);
    }
};
// ============================================================
// MODULE 9: DEVELOPER DASHBOARD METRICS
// ============================================================
export const getDeveloperDashboard = async (req, res, next) => {
    try {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const [activeKeys, totalRequests24h, webhookSuccessCount, webhookFailCount, apiKeysCount, usageLogsByRoute,] = await Promise.all([
            prisma.apiKey.count({ where: { status: "active" } }),
            prisma.apiUsageLog.count({ where: { createdAt: { gte: last24h } } }),
            prisma.webhookDelivery.count({ where: { status: "success" } }),
            prisma.webhookDelivery.count({ where: { status: "failed" } }),
            prisma.apiKey.count(),
            prisma.apiUsageLog.groupBy({
                by: ["route"],
                _count: true,
                orderBy: { _count: { route: "desc" } },
                take: 10,
            }),
        ]);
        // Top API key usage
        const topApiKeys = await prisma.apiKey.findMany({
            orderBy: { usageCount: "desc" },
            take: 5,
            select: { name: true, maskedKey: true, usageCount: true },
        });
        return sendResponse(res, 200, true, "Developer dashboard fetched successfully.", {
            metrics: {
                activeKeys,
                totalRequests24h,
                webhookSuccessCount,
                webhookFailCount,
                apiKeysCount,
                webhookSuccessRate: webhookSuccessCount + webhookFailCount > 0
                    ? `${((webhookSuccessCount / (webhookSuccessCount + webhookFailCount)) * 100).toFixed(1)}%`
                    : "100%",
            },
            topEndpoints: usageLogsByRoute.map((u) => ({
                route: u.route,
                count: u._count,
            })),
            topApiKeys,
        });
    }
    catch (err) {
        next(err);
    }
};
