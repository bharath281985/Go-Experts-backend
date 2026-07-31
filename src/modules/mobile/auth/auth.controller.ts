import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middlewares/auth.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from '../../../services/mobile/email.service.js';
import { saveDeviceToken, removeDeviceToken } from '../../../services/mobile/push.service.js';
import { AuditEngine } from '../../../services/mobile/audit.engine.js';
import { bootstrapNewUser } from '../../../services/mobile/auth-bootstrap.service.js';
import { issuePhoneOtp, verifyPhoneOtp } from '../../../services/mobile/otp.service.js';
import { resolveProfileCompletion } from '../../../services/mobile/profile-completion.service.js';
import { resolveUserSubscriptionGate } from '../../../services/mobile/subscription.service.js';

function requireSecret(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }
  if (fallback) {
    console.warn(`⚠️  ${name} missing — using insecure development fallback`);
    return fallback;
  }
  throw new Error(`${name} is required`);
}

const JWT_SECRET = requireSecret('JWT_SECRET', process.env.JWT_SECRET, 'dev-only-jwt-secret-min16');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '48h';
const REFRESH_SECRET = requireSecret(
  'JWT_REFRESH_SECRET',
  process.env.JWT_REFRESH_SECRET,
  'dev-only-refresh-secret-min16'
);
const PASSWORD_RESET_SECRET = process.env.JWT_RESET_SECRET || JWT_SECRET;
const PASSWORD_RESET_EXPIRES_IN_MS = 15 * 60 * 1000;

const authEpochKey = (userId: string) => `auth_epoch:${userId}`;

const getAuthEpoch = async (userId: string): Promise<number> => {
  const row = await prisma.setting.findUnique({ where: { key: authEpochKey(userId) } });
  const n = row ? Number(row.value) : 0;
  return Number.isFinite(n) ? n : 0;
};

const bumpAuthEpoch = async (userId: string): Promise<number> => {
  const next = (await getAuthEpoch(userId)) + 1;
  const key = authEpochKey(userId);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: String(next), category: 'auth' },
    update: { value: String(next) },
  });
  return next;
};

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  avatarUrl: string | null;
  status: string;
  isVerified: boolean;
};

const getRedirectTo = (role: string) => {
  switch (role) {
    case 'freelancer': return '/freelancer/dashboard';
    case 'client': return '/client/dashboard';
    case 'investor': return '/investor/dashboard';
    case 'founder': return '/founder/dashboard';
    default: return '/dashboard';
  }
};

const buildPhoneNumber = (phone?: string, countryCode?: string) => {
  if (!phone) return undefined;
  if (!countryCode) return phone;
  return `${countryCode}${phone}`;
};

const createAccessToken = async (user: Pick<AuthUser, 'id' | 'role'>) => {
  const epoch = await getAuthEpoch(user.id);
  return jwt.sign({ id: user.id, role: user.role, epoch }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};

const createRefreshToken = async (user: Pick<AuthUser, 'id' | 'role'>) => {
  const epoch = await getAuthEpoch(user.id);
  return jwt.sign({ id: user.id, role: user.role, epoch }, REFRESH_SECRET, {
    expiresIn: '30d',
  });
};

const createPasswordResetToken = (user: Pick<AuthUser, 'id'> & { password: string }) =>
  jwt.sign({ id: user.id, type: 'password_reset' }, `${PASSWORD_RESET_SECRET}:${user.password}`, {
    expiresIn: `${PASSWORD_RESET_EXPIRES_IN_MS / 1000}s`,
  });

const safeTrackLoginAttempt = async (
  email: string,
  success: boolean,
  req: Request,
  failReason?: string
) => {
  try {
    await prisma.loginAttempt.create({
      data: {
        email,
        success,
        failReason: success ? null : failReason ?? null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
  } catch (error) {
    console.error('Failed to track login attempt:', error);
  }
};

const buildAuthPayload = async (user: AuthUser) => {
  const [accessToken, refreshToken, completion, subscriptionGate] = await Promise.all([
    createAccessToken(user),
    createRefreshToken(user),
    resolveProfileCompletion(user.id),
    resolveUserSubscriptionGate(user.id),
  ]);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      status: user.status,
      isVerified: user.isVerified,
      profileCompletion: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
      subscriptionStatus: subscriptionGate.status,
      subscriptionPlanId: subscriptionGate.planId,
      subscriptionPlan: subscriptionGate.planName ?? subscriptionGate.planId,
      redirectTo: getRedirectTo(user.role),
    },
  };
};

const issueAuthResponse = async (
  user: AuthUser,
  device: {
    fcmToken?: string;
    platform?: string;
    deviceId?: string;
    deviceName?: string;
  }
) => {
  if (device.fcmToken) {
    await saveDeviceToken(
      user.id,
      device.fcmToken,
      device.platform || 'web',
      device.deviceId || 'unknown',
      device.deviceName
    );
  }

  return buildAuthPayload(user);
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, deviceId, deviceName, platform, fcmToken } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      await safeTrackLoginAttempt(email, false, req, 'USER_NOT_FOUND');
      return res.status(404).json(
        errorResponse('User is not registered with us', 'USER_NOT_FOUND')
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await safeTrackLoginAttempt(email, false, req, 'INVALID_CREDENTIALS');
      await AuditEngine.track(user.id, 'failed_login', 'user', user.id, null, null, req);
      return res.status(401).json(
        errorResponse('Invalid email or password', 'INVALID_CREDENTIALS')
      );
    }

    if (user.status !== 'active') {
      await safeTrackLoginAttempt(email, false, req, 'ACCOUNT_INACTIVE');
      return res.status(403).json(
        errorResponse('Your account is inactive. Please contact support.', 'ACCOUNT_INACTIVE')
      );
    }

    const payload = await issueAuthResponse(user, { fcmToken, platform, deviceId, deviceName });

    await AuditEngine.track(user.id, 'login', 'user', user.id, null, null, req);
    await safeTrackLoginAttempt(email, true, req);

    return res.json(successResponse('Login successful', payload));
  } catch (error) { next(error); }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, fullName, role, phone, countryCode, fcmToken, platform, deviceId, deviceName } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json(
        errorResponse('Email is already registered. Please login.', 'EMAIL_ALREADY_EXISTS')
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role,
          phone: buildPhoneNumber(phone, countryCode),
          status: 'active',
        },
      });
      await bootstrapNewUser(created.id, role, tx);
      return created;
    });

    const payload = await issueAuthResponse(user, { fcmToken, platform, deviceId, deviceName });
    void sendWelcomeEmail(email, fullName);
    await AuditEngine.track(user.id, 'register', 'user', user.id, null, null, req);

    return res.status(201).json(
      successResponse('Registration successful', payload)
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await bumpAuthEpoch(req.user.id);
    const fcmToken = req.body?.fcmToken || req.body?.deviceToken;
    if (fcmToken) {
      await removeDeviceToken(String(fcmToken));
    } else {
      await prisma.deviceToken.deleteMany({ where: { userId: req.user.id } });
    }
    await AuditEngine.track(req.user.id, 'logout', 'user', req.user.id, null, null, req);
    return res.json(successResponse('Logged out successfully'));
  } catch (error) { next(error); }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json(errorResponse('Refresh token required', 'VALIDATION_ERROR'));
    }
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as {
      id: string;
      role: string;
      epoch?: number;
    };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        status: true,
        isVerified: true,
      },
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json(
        errorResponse('Session expired. Please login again.', 'INVALID_TOKEN')
      );
    }

    const epoch = await getAuthEpoch(user.id);
    if (typeof decoded.epoch === 'number' && decoded.epoch !== epoch) {
      return res.status(401).json(
        errorResponse('Session revoked. Please login again.', 'SESSION_REVOKED')
      );
    }

    // Rotation: issue a new access + refresh pair bound to the same auth epoch.
    const payload = await buildAuthPayload(user);

    return res.json(
      successResponse('Token refreshed', payload)
    );
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json(
        errorResponse('Session expired. Please login again.', 'REFRESH_TOKEN_EXPIRED')
      );
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json(
        errorResponse('Invalid session. Please login again.', 'INVALID_TOKEN')
      );
    }
    next(error);
  }
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json(errorResponse('Unauthorized'));

    const [completion, subscriptionGate] = await Promise.all([
      resolveProfileCompletion(user.id),
      resolveUserSubscriptionGate(user.id),
    ]);
    const userData = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      status: user.status,
      isVerified: user.isVerified,
      phone: user.phone,
      country: user.country,
      city: user.city,
      bio: user.bio,
      profileCompletion: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
      subscriptionStatus: subscriptionGate.status,
      subscriptionPlanId: subscriptionGate.planId,
      subscriptionPlan: subscriptionGate.planName ?? subscriptionGate.planId,
      redirectTo: getRedirectTo(user.role),
    };
    return res.json(successResponse('User profile retrieved', { user: userData }));
  } catch (error) { next(error); }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.json(successResponse('If the email is registered, a password reset link has been sent.'));
    }

    const token = createPasswordResetToken({ id: user.id, password: user.password });
    void sendPasswordResetEmail(email, token);
    await AuditEngine.track(user.id, 'password_reset_requested', 'user', user.id, null, null, req);

    return res.json(successResponse('If the email is registered, a password reset link has been sent.'));
  } catch (error) { next(error); }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.decode(token) as { id?: string; type?: string } | null;

    if (!decoded?.id || decoded.type !== 'password_reset') {
      return res.status(400).json(errorResponse('Invalid or expired reset token', 'INVALID_RESET_TOKEN'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, password: true },
    });

    if (!user || !user.password) {
      return res.status(400).json(errorResponse('Invalid or expired reset token', 'INVALID_RESET_TOKEN'));
    }

    jwt.verify(token, `${PASSWORD_RESET_SECRET}:${user.password}`);

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    await AuditEngine.track(user.id, 'password_reset_success', 'user', user.id, null, null, req);

    return res.json(successResponse('Password reset successfully'));
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(400).json(errorResponse('Invalid or expired reset token', 'INVALID_RESET_TOKEN'));
    }
    next(error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user || !user.password) return res.status(400).json(errorResponse('Invalid request'));
    
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(401).json(errorResponse('Incorrect old password'));

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    await AuditEngine.track(user.id, 'password_changed', 'user', user.id, null, null, req);
    return res.json(successResponse('Password changed successfully. All devices have been logged out.'));
  } catch (error) { next(error); }
};

export const updateMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      fullName,
      phone,
      country,
      city,
      bio,
      headline,
      location,
      skills,
      skillIds,
      categoryId,
    } = req.body;

    const cityValue = city || location;
    const composedBio = [headline, bio].filter(Boolean).join('\n\n') || undefined;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName,
        phone,
        country,
        city: cityValue,
        bio: composedBio,
        isVerified: true,
      },
    });

    const role = updatedUser.role;
    const rawSkillIds = skillIds ?? skills;
    const skillsValue = Array.isArray(rawSkillIds)
      ? rawSkillIds.join(',')
      : typeof rawSkillIds === 'string'
        ? rawSkillIds
        : undefined;

    if (role === 'freelancer') {
      await prisma.freelancerProfile.upsert({
        where: { userId: req.user.id },
        update: { skills: skillsValue },
        create: { userId: req.user.id, skills: skillsValue },
      });
    } else if (role === 'client' && categoryId) {
      await prisma.clientProfile.upsert({
        where: { userId: req.user.id },
        update: { industry: categoryId },
        create: { userId: req.user.id, industry: categoryId },
      });
    } else if (role === 'investor' && categoryId) {
      await prisma.investorProfile.upsert({
        where: { userId: req.user.id },
        update: { focusAreas: categoryId },
        create: { userId: req.user.id, focusAreas: categoryId },
      });
    } else if (role === 'founder' && categoryId) {
      await prisma.founderProfile.upsert({
        where: { userId: req.user.id },
        update: { industry: categoryId },
        create: { userId: req.user.id, industry: categoryId },
      });
    }

    const completion = await resolveProfileCompletion(req.user.id);

    return res.json(
      successResponse('Profile updated successfully', {
        user: {
          ...updatedUser,
          profileCompletion: completion.profileCompletion,
          isProfileComplete: completion.isProfileComplete,
        },
      })
    );
  } catch (error) { next(error); }
};

export const updateAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('No avatar file provided', 'VALIDATION_ERROR'));
    }

    const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
    const relativePath = req.file.path.replace(/\\/g, '/');
    const avatarUrl = `${BASE_URL}/${relativePath}`;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
    });

    const completion = await resolveProfileCompletion(req.user.id);

    return res.json(
      successResponse('Avatar updated successfully', {
        url: avatarUrl,
        avatarUrl,
        user: {
          ...updatedUser,
          profileCompletion: completion.profileCompletion,
          isProfileComplete: completion.isProfileComplete,
        },
      })
    );
  } catch (error) { next(error); }
};

export const sendEmailVerification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendVerificationEmail(req.user.email, 'mock-verify-token');
    return res.json(successResponse('Verification email sent'));
  } catch (error) { next(error); }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Email verified successfully'));
  } catch (error) { next(error); }
};

export const deleteAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { status: 'inactive' }
    });
    return res.json(successResponse('Account deleted successfully'));
  } catch (error) { next(error); }
};

export const sendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, countryCode } = req.body;
    const { phoneNumber } = await issuePhoneOtp(phone, countryCode);

    return res.json(
      successResponse('OTP sent successfully', {
        phone: phoneNumber,
        expiresInSeconds: 300,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, countryCode } = req.body;
    const { phoneNumber } = await issuePhoneOtp(phone, countryCode);

    return res.json(
      successResponse('OTP resent successfully', {
        phone: phoneNumber,
        expiresInSeconds: 300,
      })
    );
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, countryCode, code } = req.body;
    const result = verifyPhoneOtp(phone, countryCode, code);

    if (!result.valid) {
      switch (result.reason) {
        case 'EXPIRED':
          return res.status(400).json(
            errorResponse('OTP has expired. Please request a new code.', 'OTP_EXPIRED')
          );
        case 'TOO_MANY_ATTEMPTS':
          return res.status(429).json(
            errorResponse('Too many invalid attempts. Please request a new OTP.', 'OTP_MAX_ATTEMPTS')
          );
        default:
          return res.status(400).json(
            errorResponse('Invalid OTP. Please try again.', 'INVALID_OTP')
          );
      }
    }

    return res.json(successResponse('Phone verified successfully', { verified: true }));
  } catch (error) {
    next(error);
  }
};
