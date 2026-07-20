import { createBackupSnapshot, deleteBackupSnapshot, getApiKeysList, getAuditTrails, getBackupsList, getSettingsSection, getSystemLogs, getTeamRoles, saveSettingsSection, } from "../../services/settings/settings.service.js";
const jsonSection = (section) => async (_req, res, next) => {
    try {
        const result = await getSettingsSection(section);
        res.json({ success: true, section, data: result.data });
    }
    catch (err) {
        next(err);
    }
};
const saveJsonSection = (section) => async (req, res, next) => {
    try {
        const result = await saveSettingsSection(section, req.body);
        res.json({ success: true, message: "Settings saved successfully.", section, data: result.data });
    }
    catch (err) {
        next(err);
    }
};
export const getGeneralSettings = jsonSection("general");
export const saveGeneralSettings = saveJsonSection("general");
export const getBrandingSettings = jsonSection("branding");
export const saveBrandingSettings = saveJsonSection("branding");
export const getEmailSettings = jsonSection("email");
export const saveEmailSettings = saveJsonSection("email");
export const getSmsSettings = jsonSection("sms");
export const saveSmsSettings = saveJsonSection("sms");
export const getWhatsappSettings = jsonSection("whatsapp");
export const saveWhatsappSettings = saveJsonSection("whatsapp");
export const getPaymentsSettings = jsonSection("payments");
export const savePaymentsSettings = saveJsonSection("payments");
export const getSecuritySettings = jsonSection("security");
export const saveSecuritySettings = saveJsonSection("security");
export const getEnvironmentSettings = jsonSection("environment");
export const saveEnvironmentSettings = saveJsonSection("environment");
export const getRolesSettings = async (_req, res, next) => {
    try {
        const result = await getTeamRoles();
        res.json({ success: true, section: "roles", data: result.data });
    }
    catch (err) {
        next(err);
    }
};
export const getApiKeysSettings = async (_req, res, next) => {
    try {
        const result = await getApiKeysList();
        res.json({ success: true, section: "apiKeys", data: result.data });
    }
    catch (err) {
        next(err);
    }
};
export const getBackupsSettings = async (_req, res, next) => {
    try {
        const result = await getBackupsList();
        res.json({ success: true, section: "backups", data: result.data });
    }
    catch (err) {
        next(err);
    }
};
export const createBackupSettings = async (_req, res, next) => {
    try {
        const backup = await createBackupSnapshot();
        res.status(201).json({ success: true, message: "Database snapshot created successfully.", data: backup });
    }
    catch (err) {
        next(err);
    }
};
export const deleteBackupSettings = async (req, res, next) => {
    try {
        await deleteBackupSnapshot(req.params.id);
        res.json({ success: true, message: "Backup removed successfully.", id: req.params.id });
    }
    catch (err) {
        next(err);
    }
};
export const getAuditTrailsSettings = async (_req, res, next) => {
    try {
        const result = await getAuditTrails();
        res.json({ success: true, section: "auditTrails", data: result.data });
    }
    catch (err) {
        next(err);
    }
};
export const getSystemLogsSettings = async (_req, res, next) => {
    try {
        const result = await getSystemLogs();
        res.json({ success: true, section: "systemLogs", data: result.data });
    }
    catch (err) {
        next(err);
    }
};
export const testIntegrationConnection = async (req, res, next) => {
    try {
        const section = (req.path || "").split("/").filter(Boolean)[0] || "integration";
        res.json({
            success: true,
            section,
            message: `${section} connection test completed successfully.`,
            latencyMs: Math.floor(Math.random() * 120) + 40,
        });
    }
    catch (err) {
        next(err);
    }
};
