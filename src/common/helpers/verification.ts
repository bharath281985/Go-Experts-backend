import { prisma } from "../../config/database.js";

export type VerificationItem = {
    key: string;
    label: string;
    value: string;
    status: "verified" | "pending" | "missing";
    documentUrl?: string | null;
    required?: boolean;
};

export const VERIFICATION_KEYS: Array<{ key: string; label: string; required?: boolean }> = [
    { key: "email", label: "Email address", required: true },
    { key: "phone", label: "Phone number", required: true },
    { key: "identity", label: "Identity (Government ID)", required: true },
    { key: "passport", label: "Passport", required: false },
    { key: "driving", label: "Driving License", required: false },
    { key: "gst", label: "GST (Optional)", required: false },
    { key: "address", label: "Address proof", required: false },
    { key: "selfie", label: "Selfie verification", required: false },
];

export function parseVerificationJson(raw: string | null | undefined): Record<string, Partial<VerificationItem>> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

export function buildVerificationItems(user: any, stored: Record<string, Partial<VerificationItem>>): VerificationItem[] {
    const location = [user.city, user.country].filter(Boolean).join(", ");
    const accountVerified = Boolean(user.isVerified || user.verified);

    return VERIFICATION_KEYS.map(({ key, label, required }) => {
        const fromStore = stored[key] || {};
        let status = (fromStore.status as VerificationItem["status"]) || "missing";
        let value = String(fromStore.value || "").trim();
        const documentUrl = fromStore.documentUrl || null;

        if (key === "email") {
            value = user.email || value || "Not set";
            status = user.email ? "verified" : "missing";
        } else if (key === "phone") {
            value = user.phone || value || "Not submitted";
            status = user.phone ? (fromStore.status as any) || "verified" : "missing";
        } else if (key === "identity") {
            if (!value) value = accountVerified ? "Account verified by admin" : "Not submitted";
            if (accountVerified && status === "missing") status = "verified";
        } else if (key === "address") {
            if (!value && location) {
                value = location;
                status = status === "missing" ? "pending" : status;
            }
            if (!value) value = "Not submitted";
        } else if (!value) {
            value = status === "missing" ? "Not submitted" : value || "Submitted";
        }

        if (!["verified", "pending", "missing"].includes(status)) status = "missing";

        return {
            key,
            label,
            value,
            status,
            documentUrl,
            required: Boolean(required),
        };
    });
}

// Extract verification details from a user based on role
export function getVerificationJsonForUser(user: any) {
    let rawJson = "{}";
    if (user.role === 'freelancer' && user.freelancerProfile) rawJson = user.freelancerProfile.verificationJson;
    if (user.role === 'client' && user.clientProfile) rawJson = user.clientProfile.verificationJson;
    if (user.role === 'founder' && user.founderProfile) rawJson = user.founderProfile.verificationJson;
    if (user.role === 'investor' && user.investorProfile) rawJson = user.investorProfile.verificationJson;
    return parseVerificationJson(rawJson);
}

// Generates the overall unified response object
export function getVerificationStats(user: any) {
    const stored = getVerificationJsonForUser(user);
    const items = buildVerificationItems(user, stored);
    const verifiedCount = items.filter((i) => i.status === "verified").length;
    const pendingCount = items.filter((i) => i.status === "pending").length;
    const missingCount = items.filter((i) => i.status === "missing").length;
    const requiredItems = items.filter((i) => i.required);
    const requiredVerified = requiredItems.filter((i) => i.status === "verified").length;
    const trustScore = Math.round((verifiedCount / Math.max(items.length, 1)) * 100);

    return {
        items,
        trustScore,
        verifiedCount,
        pendingCount,
        missingCount,
        requiredVerified,
        requiredTotal: requiredItems.length,
        accountVerified: Boolean(user.isVerified || user.verified),
        fullName: user.fullName,
        email: user.email,
    };
}

// Generic updater function that can be used globally
export async function applyVerificationUpdate(userId: string, body: any) {
    const key = String(body.key || "").trim().toLowerCase();
    if (!key || !VERIFICATION_KEYS.some((k) => k.key === key)) {
        throw new Error("Invalid verification key");
    }
    if (key === "email") {
        throw new Error("Email is verified via your account email");
    }

    const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: {
            freelancerProfile: true,
            clientProfile: true,
            founderProfile: true,
            investorProfile: true
        }
    });

    if (!user) throw new Error("User not found");

    const stored = getVerificationJsonForUser(user);
    const nextStatusRaw = body.status != null ? String(body.status).toLowerCase() : "pending";
    const nextStatus = ["verified", "pending", "missing"].includes(nextStatusRaw)
        ? (nextStatusRaw as VerificationItem["status"])
        : "pending";

    const value = body.value != null
        ? String(body.value).trim()
        : stored[key]?.value || (nextStatus === "missing" ? "Not submitted" : "Submitted for review");

    stored[key] = {
        ...stored[key],
        key,
        label: VERIFICATION_KEYS.find((k) => k.key === key)?.label || key,
        value,
        status: nextStatus,
        documentUrl: body.documentUrl != null ? String(body.documentUrl).trim() || null : stored[key]?.documentUrl || null,
    };

    if (key === "phone" && body.value) {
        await prisma.user.update({
            where: { id: userId },
            data: { phone: String(body.value).trim() },
        });
        if (nextStatus === "missing") stored[key].status = "pending";
    }

    const verificationJson = JSON.stringify(stored);
    const role = String(user.role).toLowerCase();

    // Route to correct profile based on role
    if (role === 'freelancer' || role === 'talent') {
        await prisma.freelancerProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    } else if (role === 'client') {
        await prisma.clientProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    } else if (role === 'founder' || role === 'startup founder') {
        await prisma.founderProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    } else if (role === 'investor') {
        await prisma.investorProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    }

    // Reload user and return new stats
    const freshUser = await prisma.user.findFirst({
        where: { id: userId },
        include: {
            freelancerProfile: true,
            clientProfile: true,
            founderProfile: true,
            investorProfile: true
        }
    });
    return getVerificationStats(freshUser);
}
