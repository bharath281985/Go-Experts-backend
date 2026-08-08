import { Router } from "express";
import {
  login,
  register,
  registerAdmin,
  logout,
  refresh,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  uploadAvatar,
  sendOtp,
  verifyOtp,
  getOtpInfo,
  sendVerificationLink,
  updateVerificationData,
  saveOnboardingDraft,
} from "../../controllers/auth/auth.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/signup", register);
router.post("/admin/register", registerAdmin);
router.post("/admin/signup", registerAdmin);
router.post("/logout", authMiddleware as any, logout as any);
router.post("/refresh", refresh);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", authMiddleware as any, changePassword as any);
router.get("/me", authMiddleware as any, me as any);
router.put("/me", authMiddleware as any, updateProfile as any);
router.put("/profile", authMiddleware as any, updateProfile as any);
router.post("/avatar", authMiddleware as any, upload.single("file"), uploadAvatar as any);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.get("/otp-info", getOtpInfo);
router.post("/send-verification-link", sendVerificationLink);
router.patch("/verification", authMiddleware as any, updateVerificationData as any);
router.patch("/onboarding/draft", authMiddleware as any, saveOnboardingDraft as any);

export default router;
