import { Router } from "express";
import {
  login,
  register,
  logout,
  refresh,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
  sendOtp,
  sendVerificationLink,
  updateVerificationData,
} from "../../controllers/auth/auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/logout", authMiddleware as any, logout as any);
router.post("/refresh", refresh);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", authMiddleware as any, changePassword as any);
router.get("/me", authMiddleware as any, me as any);
router.post("/send-otp", sendOtp);
router.post("/send-verification-link", sendVerificationLink);
router.patch("/verification", authMiddleware as any, updateVerificationData as any);

export default router;
