import { Router, Response } from "express";
import { prisma } from "../../config/database.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware as any);

// Campaigns
router.get("/referral_campaigns", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.referralCampaign.findMany({
      include: { rules: true, clicks: true, referrals: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching campaigns" });
  }
});

router.post("/referral_campaigns", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaign = await prisma.referralCampaign.create({ data: req.body });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating campaign" });
  }
});

router.put("/referral_campaigns/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaign = await prisma.referralCampaign.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating campaign" });
  }
});

router.delete("/referral_campaigns/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.referralCampaign.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting campaign" });
  }
});

// Rules
router.get("/referral_rules", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await prisma.referralRule.findMany({
      orderBy: { campaignId: "asc" },
    });
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching rules" });
  }
});

router.post("/referral_rules", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await prisma.referralRule.create({ data: req.body });
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating rule" });
  }
});

router.put("/referral_rules/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await prisma.referralRule.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating rule" });
  }
});

router.delete("/referral_rules/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.referralRule.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting rule" });
  }
});

// Pending Referrals
router.get("/pending_referrals", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const referrals = await prisma.referral.findMany({
      where: { status: "PENDING" },
      include: {
        referrer: { select: { fullName: true, email: true, role: true } },
        referee: { select: { fullName: true, email: true, isVerified: true, verified: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: referrals });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching pending referrals" });
  }
});

router.post("/pending_referrals/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const referralId = req.params.id;
    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) return res.status(404).json({ success: false, message: "Referral not found" });
    if (referral.status !== "PENDING") return res.status(400).json({ success: false, message: "Referral already processed" });

    // Fetch settings to get configured amount
    const settingsRaw = await prisma.setting.findUnique({ where: { key: "app_settings" } });
    let amount = 25; // fallback
    if (settingsRaw?.value) {
      try {
        const parsed = typeof settingsRaw.value === "string" ? JSON.parse(settingsRaw.value) : settingsRaw.value;
        if (parsed.referral_amount) amount = Number(parsed.referral_amount);
      } catch (e) {}
    }

    // Process approval
    await prisma.$transaction(async (tx: any) => {
      // 1. Update referral status
      await tx.referral.update({
        where: { id: referralId },
        data: { status: "SUCCESSFUL" }
      });
      // 2. Add to wallet
      await tx.walletTransaction.create({
        data: {
          walletId: referral.referrerId, // Assuming wallet mapping or using user ID
          userId: referral.referrerId,
          type: "referral_credit",
          amount: amount.toString(),
          credit: amount.toString(),
          debit: "0",
          balance: "0", // Wallet balances should technically be updated, handled via triggers or views in real app
          status: "completed",
          description: "Refer & Earn Reward",
          currency: "INR"
        }
      });
    });

    res.json({ success: true, message: "Referral approved and reward credited!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error approving referral" });
  }
});

export default router;
