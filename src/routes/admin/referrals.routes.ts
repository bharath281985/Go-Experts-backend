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

export default router;
