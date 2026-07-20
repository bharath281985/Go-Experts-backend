import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  createBackupSettings,
  deleteBackupSettings,
  getApiKeysSettings,
  getAuditTrailsSettings,
  getBackupsSettings,
  getBrandingSettings,
  getEmailSettings,
  getEnvironmentSettings,
  getGeneralSettings,
  getPaymentsSettings,
  getRolesSettings,
  getSecuritySettings,
  getSmsSettings,
  getSystemLogsSettings,
  getWhatsappSettings,
  saveBrandingSettings,
  saveEmailSettings,
  saveEnvironmentSettings,
  saveGeneralSettings,
  savePaymentsSettings,
  saveSecuritySettings,
  saveSmsSettings,
  saveWhatsappSettings,
  testIntegrationConnection,
} from "../../controllers/settings/settings.controller.js";

const router = Router();

router.use(authMiddleware as any);

// General Workspace
router.get("/general", getGeneralSettings);
router.put("/general", saveGeneralSettings);

// Branding
router.get("/branding", getBrandingSettings);
router.put("/branding", saveBrandingSettings);

// Email SMTP
router.get("/email", getEmailSettings);
router.put("/email", saveEmailSettings);
router.post("/email/test", testIntegrationConnection);

// SMS Gateway
router.get("/sms", getSmsSettings);
router.put("/sms", saveSmsSettings);
router.post("/sms/test", testIntegrationConnection);

// WhatsApp Alerts
router.get("/whatsapp", getWhatsappSettings);
router.put("/whatsapp", saveWhatsappSettings);
router.post("/whatsapp/test", testIntegrationConnection);

// Payments API
router.get("/payments", getPaymentsSettings);
router.put("/payments", savePaymentsSettings);
router.post("/payments/test", testIntegrationConnection);

// Security & MFA
router.get("/security", getSecuritySettings);
router.put("/security", saveSecuritySettings);

// Team Roles & Perms
router.get("/roles", getRolesSettings);

// API Keys
router.get("/api-keys", getApiKeysSettings);

// Environment Config
router.get("/environment", getEnvironmentSettings);
router.put("/environment", saveEnvironmentSettings);

// Database Backups
router.get("/backups", getBackupsSettings);
router.post("/backups", createBackupSettings);
router.delete("/backups/:id", deleteBackupSettings);

// Audit Trails
router.get("/audit-trails", getAuditTrailsSettings);

// System Logs
router.get("/system-logs", getSystemLogsSettings);

export default router;
