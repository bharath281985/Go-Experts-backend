import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

const prisma = new PrismaClient();

export const trackClick = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ref } = req.query;
    if (!ref || typeof ref !== "string") {
      return res.status(400).json({ success: false, message: "Missing referral code" });
    }

    const referrer = await prisma.user.findUnique({ where: { referralCode: ref } });
    if (!referrer) {
      return res.status(404).json({ success: false, message: "Invalid referral code" });
    }

    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || null;
    const userAgent = req.headers["user-agent"] || null;
    const landingSessionId = req.cookies?.sessionId || null;

    const click = await prisma.referralClick.create({
      data: {
        referralCode: ref,
        referrerId: referrer.id,
        ipAddress,
        userAgent,
        landingSessionId,
      }
    });

    res.json({ success: true, clickId: click.id });
  } catch (err) {
    next(err);
  }
};

export const getReferralDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!userId) return;

    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.referralCode) {
      // Generate one if it doesn't exist (for old users)
      let baseCode = (user.fullName.split(' ')[0] || "USER").toUpperCase().replace(/[^A-Z]/g, '');
      if (baseCode.length < 3) baseCode = "GEX" + baseCode;
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newCode = `GOEXPERTS-${baseCode}${randStr}`;

      user = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: newCode }
      });
    }

    const referralLink = `${process.env.FRONTEND_URL || "http://localhost:5175"}/register?ref=${user.referralCode}`;

    // Get referrals
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      include: {
        referee: { select: { fullName: true, createdAt: true } },
        campaign: { select: { name: true } }
      }
    });

    const totalEarned = referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0);

    // Get active rules for this user's role to show potential earnings
    const activeRules = await prisma.referralRule.findMany({
      where: {
        campaign: { status: "ACTIVE" },
        OR: [
          { referrerRole: "ANY" },
          { referrerRole: user.role }
        ]
      },
      include: { campaign: { select: { name: true } } }
    });

    res.json({
      success: true,
      data: {
        referralCode: user.referralCode,
        referralLink,
        totalReferrals: referrals.length,
        totalEarned,
        history: referrals,
        activeRules
      }
    });
  } catch (err) {
    next(err);
  }
};
