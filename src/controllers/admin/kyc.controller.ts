import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { getVerificationStats, applyVerificationUpdate } from "../../common/helpers/verification.js";

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

        // Toggle explicit verified flag on the user record directly
        if (updatePayload.verified !== undefined || updatePayload.isVerified !== undefined) {
            const isVerified = Boolean(updatePayload.verified ?? updatePayload.isVerified);
            await prisma.user.update({
                where: { id },
                data: { verified: isVerified, isVerified }
            });
            
            if (isVerified) {
                const { sendAccountActiveEmail, sendPlanActivationEmail } = await import("../../services/mobile/email.service.js");
                const userObj = await prisma.user.findFirst({ where: { id }, select: { email: true, fullName: true } });
                if (userObj && userObj.email) {
                    await sendAccountActiveEmail(userObj.email, userObj.fullName || 'User');
                    await sendPlanActivationEmail(userObj.email, userObj.fullName || 'User');
                }
            }
        }

        let stats = null;

        // Apply granular KYC key update (e.g. key: "address", value: "...", status: "verified")
        if (updatePayload.key && updatePayload.status) {
            stats = await applyVerificationUpdate(id, updatePayload);
        } else if (updatePayload.kycData && Array.isArray(updatePayload.kycData)) {
            // Support array of keys if they pass in bulk updates
            for (const update of updatePayload.kycData) {
                stats = await applyVerificationUpdate(id, update);
            }
        } else {
            // Just returning stats if only verified flag was pushed
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
            stats = getVerificationStats(user);
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
