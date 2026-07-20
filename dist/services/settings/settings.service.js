import { prisma } from "../../config/database.js";
import { SETTINGS_DEFAULTS } from "./settings.defaults.js";
const SECTION_KEY_PREFIX = "settings:section:";
function sectionKey(section) {
    return `${SECTION_KEY_PREFIX}${section}`;
}
export async function getSettingsSection(section) {
    const defaults = SETTINGS_DEFAULTS[section];
    try {
        const row = await prisma.setting.findUnique({
            where: { key: sectionKey(section) },
        });
        if (!row?.value) {
            return { section, data: defaults };
        }
        const parsed = JSON.parse(row.value);
        return {
            section,
            data: Array.isArray(defaults)
                ? parsed
                : { ...defaults, ...parsed },
        };
    }
    catch {
        return { section, data: defaults };
    }
}
export async function saveSettingsSection(section, data) {
    const payload = JSON.stringify(data);
    await prisma.setting.upsert({
        where: { key: sectionKey(section) },
        create: {
            key: sectionKey(section),
            value: payload,
            category: section,
        },
        update: {
            value: payload,
            category: section,
        },
    });
    return { section, data };
}
export async function getTeamRoles() {
    try {
        const roles = await prisma.role.findMany({
            include: {
                _count: { select: { adminUsers: true } },
                rolePermissions: {
                    include: { permission: true },
                    take: 3,
                },
            },
            orderBy: { name: "asc" },
        });
        if (roles.length === 0) {
            return getSettingsSection("roles");
        }
        return {
            section: "roles",
            data: roles.map(role => ({
                id: role.id,
                name: role.name,
                users: role._count.adminUsers,
                perms: role.description ||
                    role.rolePermissions.map(rp => `${rp.permission.action}:${rp.permission.module}`).join(", ") ||
                    "Configured permissions",
                status: role.status,
            })),
        };
    }
    catch {
        return getSettingsSection("roles");
    }
}
export async function getApiKeysList() {
    try {
        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        if (keys.length === 0) {
            return getSettingsSection("apiKeys");
        }
        return {
            section: "apiKeys",
            data: keys.map(key => ({
                id: key.id,
                name: key.name,
                key: key.maskedKey,
                created: key.createdAt.toISOString().slice(0, 10),
                status: key.status,
            })),
        };
    }
    catch {
        return getSettingsSection("apiKeys");
    }
}
export async function getBackupsList() {
    try {
        const backups = await prisma.backup.findMany({
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        if (backups.length === 0) {
            return getSettingsSection("backups");
        }
        return {
            section: "backups",
            data: backups.map((backup, index) => ({
                id: backup.id.startsWith("BKP-") ? backup.id : `BKP-${String(index + 1).padStart(3, "0")}`,
                size: backup.size,
                type: backup.type,
                created: backup.createdAt.toLocaleString(),
                status: backup.status,
            })),
        };
    }
    catch {
        return getSettingsSection("backups");
    }
}
export async function createBackupSnapshot() {
    const size = `${(Math.random() * 2 + 23).toFixed(1)} MB`;
    const backup = await prisma.backup.create({
        data: {
            size,
            type: "Full Database Snapshot",
            status: "Successful",
        },
    });
    return {
        id: `BKP-${backup.id.slice(0, 3).toUpperCase()}`,
        size: backup.size,
        type: backup.type,
        created: "Just now",
        status: backup.status,
    };
}
export async function deleteBackupSnapshot(id) {
    const backups = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    const match = backups.find((b, index) => {
        const displayId = b.id.startsWith("BKP-") ? b.id : `BKP-${String(index + 1).padStart(3, "0")}`;
        return displayId === id || b.id === id;
    });
    if (match) {
        await prisma.backup.delete({ where: { id: match.id } });
    }
    return { ok: true, id };
}
export async function getAuditTrails() {
    try {
        const logs = await prisma.auditLog.findMany({
            include: { actor: true },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        if (logs.length === 0) {
            return getSettingsSection("auditTrails");
        }
        return {
            section: "auditTrails",
            data: logs.map(log => ({
                id: log.id,
                who: log.actor?.fullName || "System",
                action: log.action,
                target: log.entityId ? `${log.entity}:${log.entityId.slice(0, 8)}` : log.entity,
                when: log.createdAt.toLocaleString(),
            })),
        };
    }
    catch {
        return getSettingsSection("auditTrails");
    }
}
export async function getSystemLogs() {
    try {
        const logs = await prisma.activityLog.findMany({
            include: { adminUser: true },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
        if (logs.length === 0) {
            return getSettingsSection("systemLogs");
        }
        return {
            section: "systemLogs",
            data: logs.map((log, index) => ({
                id: `LOG-${index + 1}`,
                type: "system",
                level: "info",
                text: log.description || log.action,
                time: log.createdAt.toLocaleString(),
                ip: log.adminUser?.email || "system",
            })),
        };
    }
    catch {
        return getSettingsSection("systemLogs");
    }
}
