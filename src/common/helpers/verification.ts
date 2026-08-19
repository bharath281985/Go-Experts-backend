import { prisma } from "../../config/database.js";

export type VerificationItem = {
    key: string;
    label: string;
    value: string;
    status: "verified" | "pending" | "missing" | "rejected";
    documentUrl?: string | null;
    required?: boolean;
};

// Canonical map of all accepted verification keys → label
export const VERIFICATION_KEY_MAP: Record<string, string> = {
    // Legacy / generic keys
    email: "Email address",
    phone: "Phone number",
  
 
    // Personal document keys (shown in UI)
    pan: "PAN Card",
    aadhaar: "Aadhaar Card",
    driving: "Driving Licence",
    // Business document keys (shown in UI)
    gst: "GST Certificate",
    udyam: "Udyam Aadhaar",
    incorporation: "Incorporation Proof",
    business_pan: "Business PAN",
    company: "Company Registration",
    driving_licence: "Driving Licence"
};

const VALID_STATUSES = ["verified", "pending", "missing", "rejected"];

export const VERIFICATION_KEYS: Array<{ key: string; label: string; required?: boolean }> = [
    { key: "email", label: "Email address", required: true },
    { key: "phone", label: "Phone number", required: false },
 
    { key: "pan", label: "PAN Card", required: false },
    { key: "aadhaar", label: "Aadhaar Card", required: false },
    { key: "driving", label: "Driving Licence", required: false },
    { key: "gst", label: "GST Certificate", required: false },
    { key: "udyam", label: "Udyam Aadhaar", required: false },
    { key: "incorporation", label: "Incorporation Proof", required: false },
    { key: "business_pan", label: "Business PAN", required: false },
    { key: "company", label: "Company Registration", required: false },
    { key: "driving_licence", label: "Driving Licence", required: false }
];

const VALIDATORS: Record<string, { regex: RegExp; message: string }> = {
    pan: { regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, message: "Invalid PAN format (e.g. ABCDE1234F)" },
    business_pan: { regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i, message: "Invalid PAN format (e.g. ABCDE1234F)" },
    aadhaar: { regex: /^[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}$/, message: "Invalid Aadhaar format (12 digits)" },
    gst: { regex: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i, message: "Invalid GST format (15 characters)" },
    udyam: { regex: /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/i, message: "Invalid Udyam format (e.g. UDYAM-MH-18-0123456)" },
    driving: { regex: /^[A-Z0-9-/\s]{10,20}$/i, message: "Invalid Driving Licence format" },
    driving_licence: { regex: /^[A-Z0-9-/\s]{10,20}$/i, message: "Invalid Driving Licence format" },
    incorporation: { regex: /^[A-Z0-9-\s]{5,25}$/i, message: "Invalid Incorporation Number format" },
    company: { regex: /^[A-Z0-9-\s]{5,25}$/i, message: "Invalid Company Registration format" },
};

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
    const accountVerified = Boolean(user.isVerified || user.verified);

    return VERIFICATION_KEYS
        .map(({ key, label, required }) => {
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
        } else if (key === "personal_id_1" || key === "personal_id_2") {
            if (!value) value = accountVerified ? "Account verified by admin" : "Not submitted";
            if (accountVerified && status === "missing") status = "verified";
        } else if (key === "address") {
            if (!value) {
                value = user.location || "Not submitted";
            }
        } else if (!value) {
            value = status === "missing" ? "Not submitted" : value || "Submitted";
        }

            return { key, label, value, status, documentUrl, required: Boolean(required) };
        });
}

// Extract verification details from a user based on role
export function getVerificationJsonForUser(user: any) {
    let rawJson = "{}";
    const role = String(user.role || "").toLowerCase().trim();
    if ((role === 'freelancer' || role === 'talent') && user.freelancerProfile) rawJson = user.freelancerProfile.verificationJson || "{}";
    if (role === 'client' && user.clientProfile) rawJson = user.clientProfile.verificationJson || "{}";
    if ((role === 'founder' || role === 'startup founder') && user.founderProfile) rawJson = user.founderProfile.verificationJson || "{}";
    if (role === 'investor' && user.investorProfile) rawJson = user.investorProfile.verificationJson || "{}";
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
        items: items.filter((i) => i.status !== "missing"),
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
    const nextStatus = ["verified", "pending", "missing", "rejected"].includes(nextStatusRaw)
        ? (nextStatusRaw as VerificationItem["status"])
        : "pending";

    const value = body.value != null ? String(body.value).trim() : (stored[key]?.value || "");

    if (value && VALIDATORS[key]) {
        if (!VALIDATORS[key].regex.test(value)) {
            throw new Error(VALIDATORS[key].message);
        }
    }

    // Enforce locking: once verified, it cannot be altered by normal user update flows.
    // If the backend tries to update a verified document to 'pending', reject it.
    if (stored[key]?.status === "verified" && nextStatus !== "verified") {
        throw new Error("Document is already verified and locked. Please contact support to request an update.");
    }

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
