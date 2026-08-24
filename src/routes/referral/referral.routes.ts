import { Router } from "express";
import { trackClick, getReferralDetails } from "../../controllers/referral/referral.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/track", trackClick);
router.get("/me", authMiddleware, getReferralDetails as any);

export default router;
