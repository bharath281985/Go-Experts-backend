import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { getVerificationStats, applyVerificationUpdate } from "../../common/helpers/verification.js";
import type { VerificationItem } from "../../common/helpers/verification.js";
import { activateFreePlanAfterKyc } from "../../services/mobile/subscription.service.js";
import {
    notifyAccountStatusChanged,
    notifyKycDocumentVerified,
    notifyKycVerified,
} from "../../services/mobile/push-events.service.js";


async function triggerReferralBonus(user: any) {
    if (!user || !user.id) return;
    try {
        const referral = await prisma.referral.findFirst({
            where: { refereeId: user.id, status: 'pending' },
            include: { referrer: true }
        });
        if (!referral) return;

        let settings: any = {};
        const settingsJson = await prisma.setting.findUnique({ where: { key: 'app_settings' } });
        if (settingsJson?.value) {
            try { settings = JSON.parse(settingsJson.value as string); } catch (e) {}
        }
        const generalSettings = settings.general || settings;
        const amount = Number(generalSettings.referral_reward_amount ?? 25);

        await prisma.$transaction(async (tx) => {
            await tx.referral.update({
                where: { id: referral.id },
                data: { status: 'completed' }
            });
            await tx.referralReward.create({
                data: {
                    referralId: referral.id,
                    amount: amount,
                    status: 'paid'
                }
            }).catch(() => null);

            let wallet = await tx.wallet.findUnique({ where: { userId: referral.referrerId } });
            if (!wallet) {
                wallet = await tx.wallet.create({ data: { userId: referral.referrerId, balance: 0, currency: "INR" } });
            }

            const updatedWallet = await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } }
            });

            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "referral_bonus",
                    direction: "credit",
                    amount,
                    description: `Referral Bonus for ${user.fullName || 'User'} verifying KYC`,
                    balanceAfter: updatedWallet.balance
                }
            });

            await tx.walletBonus.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    reason: `Referral Bonus (${user.fullName || 'User'})`,
                    status: "active",
                },
            }).catch(() => null);
        });
        console.log(`[Referral] Credited referral bonus of ${amount} to ${referral.referrerId} for referring ${user.id}`);
    } catch (e) {
        console.error("Referral bonus error:", e);
    }
}

async function getWelcomeBonusConfig() {
    const settingsRecord = await prisma.setting.findUnique({ where: { key: "app_settings" } });
    let settings: any = {};
    if (settingsRecord?.value) {
        try {
            settings = JSON.parse(settingsRecord.value);
        } catch {
            settings = {};
        }
    }

    const generalSettings = settings.general || settings;
    const enabled = generalSettings.welcomeBonusEnabled ?? generalSettings.welcome_bonus_enabled ?? true;
    const amount = Number(generalSettings.welcomeBonusAmount ?? generalSettings.welcome_bonus_amount ?? 99);

    return {
        enabled: enabled !== false,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 99,
    };
}

async function triggerWelcomeBonus(user: any) {
    if (!user || !user.id || !user.email) return;

    try {
        const { enabled, amount } = await getWelcomeBonusConfig();
        if (!enabled) return;

        const result = await prisma.$transaction(async (tx) => {
            let wallet = await tx.wallet.findUnique({ where: { userId: user.id } });
            if (!wallet) {
                wallet = await tx.wallet.create({ data: { userId: user.id, balance: 0, currency: "INR" } });
            }

            const existingTxn = await tx.walletTransaction.findFirst({
                where: {
                    walletId: wallet.id,
                    direction: "credit",
                    OR: [
                        { type: "welcome_bonus" },
                        { type: "Bonus", description: "Welcome Bonus" },
                        { description: "Welcome Bonus" },
                    ],
                },
            });
            if (existingTxn) return null;

            const updatedWallet = await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } }
            });
            const transaction = await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "welcome_bonus",
                    direction: "credit",
                    amount,
                    description: "Welcome Bonus",
                    balanceAfter: updatedWallet.balance
                }
            });
            await tx.walletBonus.create({
                data: {
                    walletId: wallet.id,
                    amount,
                    reason: "Welcome Bonus",
                    status: "active",
                },
            }).catch(() => null);

            return transaction;
        });

        if (!result) return;

        const { sendWelcomeBonusEmail } = await import("../../services/mobile/email.service.js");
        await sendWelcomeBonusEmail(user.email, user.fullName || 'User', amount);
    } catch (e) {
        console.error("Welcome bonus error:", e);
    }
}


type KycStatusEmailDocument = {
    label: string;
    status: string;
    reason?: string | null;
};

function getKycUpdatesFromPayload(updatePayload: any) {
    const rawUpdates = Array.isArray(updatePayload?.kycData)
        ? updatePayload.kycData
        : updatePayload?.key
            ? [updatePayload]
            : [];

    return rawUpdates
        .map((update: any) => ({
            key: String(update?.key || "").trim().toLowerCase(),
            status: String(update?.status || "").trim().toLowerCase()
        }))
        .filter((update: any) => update.key && ["verified", "rejected"].includes(update.status));
}

async function sendKycStatusEmailForAdminUpdate(userId: string, updatePayload: any, stats: any) {
    const changedUpdates = getKycUpdatesFromPayload(updatePayload);
    if (!changedUpdates.length || !stats?.items?.length) return;

    const changedKeys = new Set(changedUpdates.map((update: any) => update.key));
    const documents: KycStatusEmailDocument[] = (stats.items as VerificationItem[])
        .filter((item) => changedKeys.has(item.key) && ["verified", "rejected"].includes(item.status))
        .map((item) => ({
            label: item.label || item.key,
            status: item.status,
            reason: item.rejectReason || null
        }));

    if (!documents.length) return;

    const userObj = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { email: true, fullName: true, role: true }
    });
    if (!userObj?.email) return;

    try {
        const { sendKycDocumentStatusEmail } = await import("../../services/mobile/email.service.js");
        await sendKycDocumentStatusEmail(
            userObj.email,
            userObj.fullName || "User",
            userObj.role || "user",
            documents,
            stats.kycStatus || null
        );
    } catch (emailError) {
        console.error("KYC status email error:", emailError);
    }
}

// Get user KYC details (for both freelancer and client)
export const getUserKyc = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findFirst({
            where: { id, deletedAt: null },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({
            success: true,
            data: getVerificationStats(user)
        });

    } catch (error) {
        next(error);
    }
};

// Update user KYC details (approve/reject/update)
export const updateUserKyc = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const updatePayload = req.body || {};

        // Fetch user first to check stats if approving
        const user = await prisma.user.findFirst({
            where: { id, deletedAt: null },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        const wasKycApproved = getVerificationStats(user).kycApproved;

        // Toggle explicit verified flag on the user record directly
        if (updatePayload.verified !== undefined || updatePayload.isVerified !== undefined) {
            const isVerified = Boolean(updatePayload.verified ?? updatePayload.isVerified);
            
            if (isVerified) {
                const checkStats = getVerificationStats(user);
                if (checkStats.missingCount > 0) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Cannot approve user. ${checkStats.missingCount} mandatory verification documents are missing.` 
                    });
                }
            }
            await prisma.user.update({
                where: { id },
                data: { verified: isVerified, isVerified }
            });
            
            if (isVerified) {
                const { sendAccountActiveEmail } = await import("../../services/mobile/email.service.js");
                const userObj = await prisma.user.findFirst({ where: { id }, select: { id: true, email: true, fullName: true } });
                if (userObj && userObj.email) {
                    await sendAccountActiveEmail(userObj.email, userObj.fullName || 'User');
                    await activateFreePlanAfterKyc(userObj.id);
                    await triggerWelcomeBonus(userObj);
                }
            }
        }

        let stats = null;

        // Apply granular KYC key update (e.g. key: "address", value: "...", status: "verified")
        if (updatePayload.key && updatePayload.status) {
            stats = await applyVerificationUpdate(id, updatePayload, true);
        } else if (updatePayload.kycData && Array.isArray(updatePayload.kycData)) {
            // Support array of keys if they pass in bulk updates
            for (const update of updatePayload.kycData) {
                stats = await applyVerificationUpdate(id, update, true);
            }
        } else {
            // Just returning stats if only verified flag was pushed
            // We already fetched user above, but we need fresh stats in case they were updated
            const freshUser = await prisma.user.findFirst({
                where: { id, deletedAt: null },
                include: {
                    freelancerProfile: true,
                    clientProfile: true,
                    founderProfile: true,
                    investorProfile: true
                }
            });
            stats = freshUser ? getVerificationStats(freshUser) : getVerificationStats(user);
        }

        await sendKycStatusEmailForAdminUpdate(id, updatePayload, stats);

        const verifiedDocumentKeys = new Set(
            getKycUpdatesFromPayload(updatePayload)
                .filter((update: any) => update.status === "verified")
                .map((update: any) => update.key),
        );
        for (const item of (stats?.items || []) as VerificationItem[]) {
            if (verifiedDocumentKeys.has(item.key)) {
                await notifyKycDocumentVerified({
                    userId: id,
                    documentKey: item.key,
                    documentLabel: item.label,
                }).catch(console.error);
            }
        }

        // Auto-approve user and credit welcome bonus if all required documents are verified.
        // Bonus credit is idempotent, so already-verified users who missed it can receive it now.
        if (stats && stats.requiredTotal > 0 && stats.requiredVerified >= stats.requiredTotal) {
            const freshUserForCheck = await prisma.user.findFirst({ where: { id, deletedAt: null } });
            if (freshUserForCheck) {
                const wasAlreadyVerified = Boolean(freshUserForCheck.verified && freshUserForCheck.isVerified);
                if (!wasAlreadyVerified) {
                    await prisma.user.update({
                        where: { id },
                        data: { verified: true, isVerified: true }
                    });
                    
                    try {
                        const { emitToAdmins } = await import("../../services/notifications/notification-events.service.js");
                        await emitToAdmins({
                            type: "KYC_APPROVED",
                            title: "KYC Approved",
                            message: `User ${freshUserForCheck.fullName || freshUserForCheck.email} has been fully verified.`,
                            contextType: "user",
                            contextId: freshUserForCheck.id,
                            priority: "low"
                        });
                    } catch (e) { console.error("Admin emit error", e); }

                    const { sendAccountActiveEmail } = await import("../../services/mobile/email.service.js");
                    if (freshUserForCheck.email) {
                        await sendAccountActiveEmail(freshUserForCheck.email, freshUserForCheck.fullName || 'User');
                    }
                        await notifyAccountStatusChanged(freshUserForCheck.id, 'active').catch(console.error);
                }
                await activateFreePlanAfterKyc(freshUserForCheck.id);
                await triggerWelcomeBonus(freshUserForCheck);
                await triggerReferralBonus(freshUserForCheck);
            }
        }

        if (!wasKycApproved && stats?.kycApproved) {
            await notifyKycVerified(id).catch(console.error);
        }

        // Return the updated info using unified format
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

// Delete / reset user KYC 
export const deleteUserKyc = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findFirst({
            where: { id, deletedAt: null },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Remove verified status
        await prisma.user.update({
            where: { id },
            data: { verified: false, isVerified: false }
        });

        // Unified wiping logic
        const role = String(user.role).toLowerCase();

        if (role === 'freelancer' || role === 'talent') {
            await prisma.freelancerProfile.upsert({
                where: { userId: id },
                update: { verificationJson: JSON.stringify({}) },
                create: { userId: id, verificationJson: JSON.stringify({}) }
            });
        } else if (role === 'client') {
            await prisma.clientProfile.upsert({
                where: { userId: id },
                update: { verificationJson: JSON.stringify({}) },
                create: { userId: id, verificationJson: JSON.stringify({}) }
            });
        } else if (role === 'founder' || role === 'startup founder') {
            await prisma.founderProfile.upsert({
                where: { userId: id },
                update: { verificationJson: JSON.stringify({}) },
                create: { userId: id, verificationJson: JSON.stringify({}) }
            });
        } else if (role === 'investor') {
            await prisma.investorProfile.upsert({
                where: { userId: id },
                update: { verificationJson: JSON.stringify({}) },
                create: { userId: id, verificationJson: JSON.stringify({}) }
            });
        }

        res.json({ success: true, message: "KYC data cleared." });
    } catch (error) {
        next(error);
    }
};
