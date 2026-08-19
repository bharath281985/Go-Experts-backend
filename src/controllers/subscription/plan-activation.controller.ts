import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { issueEmailOtp, verifyEmailOtp } from "../../services/mobile/otp.service.js";
import { sendPlanActivationOtpEmail } from "../../services/mobile/email.service.js";
import { activateFreeTrialOnKycApproval } from "../../services/subscription/free-trial.service.js";

const errorResponse = (message: string, code: string) => ({ success: false, message, code });
const successResponse = (message: string, data?: any) => ({ success: true, message, data });

export const sendActivationOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json(errorResponse('Email is required', 'VALIDATION_ERROR'));
    }

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null }
    });

    if (!user) {
      return res.status(404).json(errorResponse('User not found', 'USER_NOT_FOUND'));
    }

    if (!user.verified) {
      return res.status(403).json(errorResponse('KYC is not approved yet', 'KYC_NOT_APPROVED'));
    }

    const { code } = await issueEmailOtp(email);
    const emailSent = await sendPlanActivationOtpEmail(email, code);

    if (!emailSent) {
      return res.status(500).json(errorResponse('Failed to send OTP email', 'EMAIL_SEND_FAILED'));
    }

    return res.json(successResponse('OTP sent successfully', { email }));
  } catch (error) {
    next(error);
  }
};

export const verifyActivationOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json(errorResponse('Email and OTP are required', 'VALIDATION_ERROR'));
    }

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null }
    });

    if (!user) {
      return res.status(404).json(errorResponse('User not found', 'USER_NOT_FOUND'));
    }

    // Verify OTP
    const isValid = await verifyEmailOtp(email, otp);
    if (!isValid) {
      return res.status(400).json(errorResponse('Invalid or expired OTP', 'INVALID_OTP'));
    }

    // Activate the free trial
    await activateFreeTrialOnKycApproval(user.id);

    return res.json(successResponse('Free plan activated successfully'));
  } catch (error) {
    next(error);
  }
};
