import { Router } from "express";
import { sendActivationOtp, verifyActivationOtp } from "../../controllers/subscription/plan-activation.controller.js";

const router = Router();

router.post("/send-activation-otp", sendActivationOtp);
router.post("/verify-activation-otp", verifyActivationOtp);

export default router;

