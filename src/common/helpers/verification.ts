import { prisma } from "../../config/database.js";

export type VerificationItem = {
    key: string;
    label: string;
    value: string;
    status: "verified" | "pending" | "missing" | "rejected";
    documentUrl?: string | null;
    rejectReason?: string | null;
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
    pan: { regex: /^[a-zA-Z0-9]{10}$/, message: "Invalid PAN format (10 alphanumeric characters)" },
    business_pan: { regex: /^[a-zA-Z0-9]{10}$/, message: "Invalid PAN format (10 alphanumeric characters)" },
    aadhaar: { regex: /^[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}$/, message: "Invalid Aadhaar format (12 digits)" },
    gst: { regex: /^[a-zA-Z0-9]{15}$/, message: "Invalid GST format (15 alphanumeric characters)" },
    udyam: { regex: /^[a-zA-Z0-9-]{10,25}$/, message: "Invalid Udyam format (10-25 characters)" },
    driving: { regex: /^[A-Z0-9-/\s]{10,20}$/i, message: "Invalid Driving Licence format" },
    driving_licence: { regex: /^[A-Z0-9-/\s]{10,20}$/i, message: "Invalid Driving Licence format" },
    incorporation: { regex: /^[A-Z0-9-\s]{5,25}$/i, message: "Invalid Incorporation Number format" },
    company: { regex: /^[A-Z0-9-\s]{5,25}$/i, message: "Invalid Company Registration format" },
};

const getVerificationRequirement = (role: string) => {
    const normalizedRole = role.toLowerCase().trim();
    if (normalizedRole === "freelancer" || normalizedRole === "talent") {
        return { personalRequired: 2, businessRequired: 0 };
    }
    return { personalRequired: 2, businessRequired: 2 };
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
        const rejectReason = fromStore.rejectReason || null;

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

            return { key, label, value, status, documentUrl, rejectReason, required: Boolean(required) };
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
    const requirement = getVerificationRequirement(String(user.role || ""));
    
    // Group keys
    const personalKeys = ["pan", "aadhaar", "driving", "driving_licence"];
    const businessKeys = ["gst", "udyam", "incorporation", "business_pan", "company"];
    
    // Calculate submitted items (verified or pending)
    const personalSubmitted = items.filter(i => personalKeys.includes(i.key) && (i.status === "verified" || i.status === "pending")).length;
    const businessSubmitted = items.filter(i => businessKeys.includes(i.key) && (i.status === "verified" || i.status === "pending")).length;
    
    const emailItem = items.find(i => i.key === "email");
    const isEmailMissing = !emailItem || emailItem.status === "missing";
    const isEmailVerified = emailItem?.status === "verified";
    
    // Calculate missing counts
    const missingPersonal = Math.max(0, requirement.personalRequired - personalSubmitted);
    const missingBusiness = Math.max(0, requirement.businessRequired - businessSubmitted);
    const missingEmail = isEmailMissing ? 1 : 0;
    const missingCount = missingEmail + missingPersonal + missingBusiness;
    
    // Calculate verified counts for the required groups
    const personalVerified = items.filter(i => personalKeys.includes(i.key) && i.status === "verified").length;
    const businessVerified = items.filter(i => businessKeys.includes(i.key) && i.status === "verified").length;
    const requiredPersonalVerified = Math.min(requirement.personalRequired, personalVerified);
    const requiredBusinessVerified = Math.min(requirement.businessRequired, businessVerified);
    const kycApproved = personalVerified >= requirement.personalRequired && businessVerified >= requirement.businessRequired;
    const profileApproved = Boolean(user.isVerified || user.verified);
    
    const requiredTotal = 1 + requirement.personalRequired + requirement.businessRequired;
    const requiredVerified = (isEmailVerified ? 1 : 0)
        + requiredPersonalVerified
        + requiredBusinessVerified;
    const trustScore = Math.min(100, Math.round((requiredVerified / requiredTotal) * 100));

    return {
        items: items.filter((i) => i.status !== "missing"),
        trustScore,
        verifiedCount,
        pendingCount,
        missingCount,
        requiredVerified,
        requiredTotal,
        personalRequired: requirement.personalRequired,
        businessRequired: requirement.businessRequired,
        personalVerified,
        businessVerified,
        requiredPersonalVerified,
        requiredBusinessVerified,
        profileApproved,
        kycApproved,
        kycStatus: kycApproved
            ? "APPROVED"
            : pendingCount > 0
                ? "PENDING"
                : missingCount > 0
                    ? "MISSING"
                    : "PENDING",
        accountVerified: profileApproved,
        fullName: user.fullName,
        email: user.email,
    };
}

// Generic updater function that can be used globally
export async function applyVerificationUpdate(userId: string, body: any, isAdmin: boolean = false) {
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
    // If the backend tries to update a verified document to 'pending', reject it unless it's an admin.
    if (!isAdmin && stored[key]?.status === "verified" && nextStatus !== "verified") {
        throw new Error("Document is already verified and locked. Please contact support to request an update.");
    }

    stored[key] = {
        ...stored[key],
        key,
        label: VERIFICATION_KEYS.find((k) => k.key === key)?.label || key,
        value,
        status: nextStatus,
        documentUrl: body.documentUrl != null ? String(body.documentUrl).trim() || null : stored[key]?.documentUrl || null,
        rejectReason: body.reason != null ? String(body.reason).trim() : stored[key]?.rejectReason || null,
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
