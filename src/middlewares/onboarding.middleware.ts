import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware.js";

export const requireOnboarding = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // Admins do not have onboarding requirements in this context
  if (req.user.type === "admin") {
    return next();
  }

  // Portal users must have COMPLETED onboarding to proceed
  if (req.user.onboardingStatus !== "COMPLETED") {
    return res.status(403).json({
      success: false,
      message: "Onboarding incomplete. Please complete your profile.",
      code: "ONBOARDING_REQUIRED",
    });
  }

  next();
};
