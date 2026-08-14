import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { getVerificationStats, applyVerificationUpdate } from "../../common/helpers/verification.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

export const getMyVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await prisma.user.findFirst({
            where: { id: req.user.id, deletedAt: null },
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

export const updateMyVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const stats = await applyVerificationUpdate(req.user.id, req.body);
        const targetItem = stats.items.find(i => i.key === req.body.key);

        res.json({
            success: true,
            message: "Verification updated successfully",
            data: targetItem || { key: req.body.key }
        });
    } catch (error) {
        next(error);
    }
};

export const deleteMyVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        // If they want to delete a specific key from their verification
        const key = req.query.key || req.body.key;
        if (key) {
            const payload = {
                key: String(key),
                status: "missing",
                value: "",
                documentUrl: ""
            };
            const stats = await applyVerificationUpdate(req.user.id, payload);
            return res.json({ success: true, message: "Verification document deleted successfully", data: stats });
        }

        // Otherwise, completely wipe it
        const user = await prisma.user.findFirst({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const role = String(user.role).toLowerCase();
        const emptyJson = JSON.stringify({});

        if (role === 'freelancer' || role === 'talent') {
            await prisma.freelancerProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        } else if (role === 'client') {
            await prisma.clientProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        } else if (role === 'founder' || role === 'startup founder') {
            await prisma.founderProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        } else if (role === 'investor') {
            await prisma.investorProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        }

        // Return completely refreshed stats
        const freshUser = await prisma.user.findFirst({
            where: { id: user.id },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });

        res.json({ success: true, message: "Verification reset successfully", data: getVerificationStats(freshUser) });
    } catch (error) {
        next(error);
    }
};
