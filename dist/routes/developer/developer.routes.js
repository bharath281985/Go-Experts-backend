import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { generateApiKey, listApiKeys, revokeApiKey, regenerateApiKey, createWebhook, listWebhooks, updateWebhook, deleteWebhook, testWebhook, listWebhookDeliveries, replayWebhookDelivery, getDeveloperDashboard, } from "../../controllers/developer/developer.controller.js";
const router = Router();
// Require super-admin or admin JWT authentication
router.use(authMiddleware);
// ─────────────────────────────────────────────
// Developer Platform Dashboard
// ─────────────────────────────────────────────
router.get("/dashboard", getDeveloperDashboard);
// ─────────────────────────────────────────────
// API Keys Management
// ─────────────────────────────────────────────
router.post("/keys", generateApiKey);
router.get("/keys", listApiKeys);
router.post("/keys/:id/revoke", revokeApiKey);
router.post("/keys/:id/regenerate", regenerateApiKey);
// ─────────────────────────────────────────────
// Webhooks Administration
// ─────────────────────────────────────────────
router.post("/webhooks", createWebhook);
router.get("/webhooks", listWebhooks);
router.put("/webhooks/:id", updateWebhook);
router.delete("/webhooks/:id", deleteWebhook);
router.post("/webhooks/:id/test", testWebhook);
// ─────────────────────────────────────────────
// Webhook Telemetry & Deliveries
// ─────────────────────────────────────────────
router.get("/webhooks/deliveries", listWebhookDeliveries);
router.post("/webhooks/deliveries/:id/replay", replayWebhookDelivery);
export default router;
