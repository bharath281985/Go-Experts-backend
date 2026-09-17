import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { createBackupSettings, deleteBackupSettings, getApiKeysSettings, saveApiKeysSettings, getAppsSettings, saveAppsSettings, getAuditTrailsSettings, getBackupsSettings, getBrandingSettings, getCountrySettings, getCurrencySettings, getEmailSettings, getEnvironmentSettings, getGeneralSettings, getGoogleMapsSettings, getPaymentsSettings, getRolesSettings, getSecuritySettings, getSmsSettings, getSplashSettings, getSystemLogsSettings, getWhatsappSettings, saveBrandingSettings, saveCountrySettings, saveCurrencySettings, saveEmailSettings, saveEnvironmentSettings, saveGeneralSettings, saveGoogleMapsSettings, savePaymentsSettings, saveSecuritySettings, saveSmsSettings, saveSplashSettings, saveWhatsappSettings, sendTestEmailHandler, testIntegrationConnection, getEmailTemplates, saveEmailTemplate, deleteEmailTemplate, getIndustryColorsSettings, saveIndustryColorsSettings, } from "../../controllers/settings/settings.controller.js";
const router = Router();
router.use(authMiddleware);
import { prisma } from "../../config/database.js";
// Root generic settings 
router.get("/", async (req, res) => {
    try {
        const settings = await prisma.setting.findMany();
        const data = {};
        for (const s of settings)
            data[s.key] = s.value;
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Error fetching settings" });
    }
});
router.put("/", async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key)
            return res.status(400).json({ success: false, message: "Key required" });
        const strValue = typeof value === "string" ? value : JSON.stringify(value);
        await prisma.setting.upsert({
            where: { key },
            update: { value: strValue },
            create: { key, value: strValue, category: "general" }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Error saving setting" });
    }
});
// General Workspace
router.get("/general", getGeneralSettings);
router.put("/general", saveGeneralSettings);
// Splash Screen
router.get("/splash", getSplashSettings);
router.put("/splash", saveSplashSettings);
// Role Colors
router.get("/industry-colors", getIndustryColorsSettings);
router.put("/industry-colors", saveIndustryColorsSettings);
// Branding
router.get("/branding", getBrandingSettings);
router.put("/branding", saveBrandingSettings);
// Country Settings
router.get("/country", getCountrySettings);
router.put("/country", saveCountrySettings);
// Currency Settings
router.get("/currency", getCurrencySettings);
router.put("/currency", saveCurrencySettings);
// Google Maps Settings
router.get("/google-maps", getGoogleMapsSettings);
router.put("/google-maps", saveGoogleMapsSettings);
// Email SMTP Settings & Templates
router.get("/email", getEmailSettings);
router.put("/email", saveEmailSettings);
router.post("/email/test", sendTestEmailHandler);
router.get("/email/templates", getEmailTemplates);
router.post("/email/templates", saveEmailTemplate);
router.put("/email/templates", saveEmailTemplate);
router.delete("/email/templates/:id", deleteEmailTemplate);
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
router.put("/api-keys", saveApiKeysSettings);
// Connected Apps
router.get("/apps", getAppsSettings);
router.put("/apps", saveAppsSettings);
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
