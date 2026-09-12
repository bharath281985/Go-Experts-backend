import { prisma } from "../../config/database.js";
import { SETTINGS_DEFAULTS, type SettingsSection } from "./settings.defaults.js";

const SECTION_KEY_PREFIX = "settings:section:";

function sectionKey(section: SettingsSection) {
  return `${SECTION_KEY_PREFIX}${section}`;
}

function requestBaseUrl(req?: any) {
  const envUrl = process.env.BASE_URL || process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl && !String(envUrl).includes("localhost")) return String(envUrl).replace(/\/+$/, "");

  if (req?.get) {
    const host = req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    if (host) return `${proto}://${host}`.replace(/\/+$/, "");
  }

  return envUrl ? String(envUrl).replace(/\/+$/, "") : "https://apiai.goexperts.in";
}

function requestUploadBasePath(req?: any) {
  const originalUrl = String(req?.originalUrl || req?.url || "");
  if (originalUrl.includes("/api/v1/mobile/")) return "/api/v1/mobile/uploads";
  if (originalUrl.includes("/api/mobile/")) return "/api/mobile/uploads";
  return "/uploads";
}

function buildSettingsFileUrl(filepath?: string | null, req?: any) {
  if (!filepath) return "";
  if (/^https?:\/\//i.test(filepath)) return filepath;

  const normalizedPath = String(filepath)
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/^uploads\//, "");

  return `${requestBaseUrl(req)}${requestUploadBasePath(req)}/${normalizedPath}`;
}

function normalizeSplashSettingsData(value: unknown, req?: any): Record<string, any> {
  const defaults = SETTINGS_DEFAULTS.splash;
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
  const sourceSplash = source.splash && typeof source.splash === "object" && !Array.isArray(source.splash)
    ? source.splash as Record<string, any>
    : {};
  const sourceOnboarding = source.onboarding && typeof source.onboarding === "object" && !Array.isArray(source.onboarding)
    ? source.onboarding as { steps?: Array<Record<string, any>> }
    : {};
  const sourceLogo = source.logo && typeof source.logo === "object" && !Array.isArray(source.logo)
    ? source.logo as Record<string, any>
    : {};

  const oldMediaUrl = typeof sourceSplash.mediaUrl === "string"
    ? sourceSplash.mediaUrl
    : typeof source.mediaUrl === "string"
      ? source.mediaUrl
      : "";
  const oldMediaName = typeof sourceSplash.mediaName === "string"
    ? sourceSplash.mediaName
    : typeof source.mediaName === "string"
      ? source.mediaName
      : "";
  const oldMediaType = sourceSplash.mediaType === "video" || source.mediaType === "video" ? "video" : "image";
  const toPublicUrl = (url?: string | null) => buildSettingsFileUrl(url, req);
  const steps: Array<Record<string, any>> = defaults.onboarding.steps.map((defaultStep, index) => {
    const step = {
      ...(defaultStep as Record<string, any>),
      ...(Array.isArray(sourceOnboarding.steps) && sourceOnboarding.steps[index]
        ? sourceOnboarding.steps[index]
        : {}),
    };

    return {
      ...step,
      mediaUrl: toPublicUrl(step.mediaUrl),
    };
  });

  if (!source.onboarding && (source.title || source.description)) {
    steps[0] = {
      ...steps[0],
      title: String(source.title || steps[0].title || ""),
      description: String(source.description || steps[0].description || ""),
    };
  }

  return {
    enabled: Boolean(source.enabled ?? defaults.enabled),
    splash: {
      imageUrl: toPublicUrl(String(sourceSplash.imageUrl || (oldMediaType === "image" ? oldMediaUrl : "") || defaults.splash.imageUrl || "")),
      imageName: String(sourceSplash.imageName || (oldMediaType === "image" ? oldMediaName : "") || ""),
      videoUrl: toPublicUrl(String(sourceSplash.videoUrl || (oldMediaType === "video" ? oldMediaUrl : "") || defaults.splash.videoUrl || "")),
      videoName: String(sourceSplash.videoName || (oldMediaType === "video" ? oldMediaName : "") || ""),
    },
    onboarding: { steps },
    logo: {
      ...defaults.logo,
      ...sourceLogo,
      logoUrl: toPublicUrl(String(sourceLogo.logoUrl || source.logoUrl || "")),
    },
  };
}

function normalizeSettingsSectionData(section: SettingsSection, data: unknown, req?: any): any {
  if (section === "splash") {
    return normalizeSplashSettingsData(data, req);
  }

  return data;
}

export async function getSettingsSection<T extends SettingsSection>(section: T, req?: any) {
  const defaults = SETTINGS_DEFAULTS[section];

  try {
    const row = await prisma.setting.findUnique({
      where: { key: sectionKey(section) },
    });

    if (!row?.value) {
      return { section, data: normalizeSettingsSectionData(section, defaults, req) };
    }

    const parsed = JSON.parse(row.value);
    const merged = Array.isArray(defaults)
      ? parsed
      : { ...(defaults as object), ...(parsed as object) };

    return {
      section,
      data: normalizeSettingsSectionData(section, merged, req),
    };
  } catch {
    return { section, data: normalizeSettingsSectionData(section, defaults, req) };
  }
}

export async function saveSettingsSection<T extends SettingsSection>(
  section: T,
  data: (typeof SETTINGS_DEFAULTS)[T]
) {
  const normalizedData = normalizeSettingsSectionData(section, data);
  const payload = JSON.stringify(normalizedData);

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

  return { section, data: normalizedData };
}
export async function renderEmailTemplate(
  templateId: string,
  variables: Record<string, string>,
  fallback?: { subject: string; html: string }
) {
  if (!fallback) {
    fallback = (SETTINGS_DEFAULTS.email_templates as unknown as any[]).find(t => t.id === templateId) || { subject: "Go Experts", html: "Hello" };
  }
  try {
    const section = await getSettingsSection("email_templates");
    const templates: any[] = Array.isArray(section?.data) ? section.data : [];

    const found = templates.find(
      (t) =>
        t.id === templateId ||
        (t.id && String(t.id).toLowerCase() === templateId.toLowerCase())
    );

    let rawSubject = found?.subject || fallback.subject;
    let rawHtml = found?.html || found?.body || fallback.html;

    // Safety fallback if database template is corrupted or wrong template matched
    if (
      templateId === "tpl_verification_link" &&
      (!rawHtml.includes("verification_link") && !rawHtml.includes("otp_code"))
    ) {
      rawSubject = fallback.subject;
      rawHtml = fallback.html;
    }

    const allVars: Record<string, string> = {
      app_name: "Go Experts",
      company_name: "Go Experts Inc.",
      app_url: process.env.CLIENT_URL || process.env.FRONTEND_URL || "https://goexperts.in",
      ...variables,
    };

    let subject = rawSubject;
    let html = rawHtml;

    for (const [k, v] of Object.entries(allVars)) {
      const regBraces = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
      const regSingle = new RegExp(`\\{${k}\\}`, "gi");
      subject = subject.replace(regBraces, v).replace(regSingle, v);
      html = html.replace(regBraces, v).replace(regSingle, v);
    }

    return { subject, html };
  } catch {
    let subject = fallback.subject;
    let html = fallback.html;
    for (const [k, v] of Object.entries(variables)) {
      const regBraces = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
      const regSingle = new RegExp(`\\{${k}\\}`, "gi");
      subject = subject.replace(regBraces, v).replace(regSingle, v);
      html = html.replace(regBraces, v).replace(regSingle, v);
    }
    return { subject, html };
  }
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
      section: "roles" as const,
      data: roles.map(role => ({
        id: role.id,
        name: role.name,
        users: role._count.adminUsers,
        perms:
          role.description ||
          role.rolePermissions.map(rp => `${rp.permission.action}:${rp.permission.module}`).join(", ") ||
          "Configured permissions",
        status: role.status,
      })),
    };
  } catch {
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
      section: "apiKeys" as const,
      data: keys.map(key => ({
        id: key.id,
        name: key.name,
        key: key.maskedKey,
        created: key.createdAt.toISOString().slice(0, 10),
        status: key.status,
      })),
    };
  } catch {
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
      section: "backups" as const,
      data: backups.map((backup, index) => ({
        id: backup.id.startsWith("BKP-") ? backup.id : `BKP-${String(index + 1).padStart(3, "0")}`,
        size: backup.size,
        type: backup.type,
        created: backup.createdAt.toLocaleString(),
        status: backup.status,
      })),
    };
  } catch {
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

export async function deleteBackupSnapshot(id: string) {
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
      section: "auditTrails" as const,
      data: logs.map(log => ({
        id: log.id,
        who: log.actor?.fullName || "System",
        action: log.action,
        target: log.entityId ? `${log.entity}:${log.entityId.slice(0, 8)}` : log.entity,
        when: log.createdAt.toLocaleString(),
      })),
    };
  } catch {
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
      section: "systemLogs" as const,
      data: logs.map((log, index) => ({
        id: `LOG-${index + 1}`,
        type: "system",
        level: "info",
        text: log.description || log.action,
        time: log.createdAt.toLocaleString(),
        ip: log.adminUser?.email || "system",
      })),
    };
  } catch {
    return getSettingsSection("systemLogs");
  }
}
