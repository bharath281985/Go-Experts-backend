import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { saveDeviceToken } from '../../../services/mobile/push.service.js';
import { AuditEngine } from '../../../services/mobile/audit.engine.js';
import { bootstrapNewUser, bootstrapUserResources, isValidRole } from '../../../services/mobile/auth-bootstrap.service.js';
import { resolveProfileCompletion } from '../../../services/mobile/profile-completion.service.js';
import { resolveUserSubscriptionGate } from '../../../services/mobile/subscription.service.js';
import {
  verifyAppleIdToken,
  verifyGoogleIdToken,
} from '../../../services/mobile/social-auth.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '48h';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

const getRedirectTo = (role: string) => {
  switch (role) {
    case 'freelancer': return '/freelancer/dashboard';
    case 'client': return '/client/dashboard';
    case 'investor': return '/investor/dashboard';
    case 'founder': return '/founder/dashboard';
    default: return '/dashboard';
  }
};

const issueAuthResponse = async (
  user: { id: string; email: string; fullName: string; role: string; avatarUrl: string | null; status: string; isVerified: boolean },
  deviceId?: string,
  fcmToken?: string,
  platform?: string,
  deviceName?: string
) => {
  if (fcmToken) {
    await saveDeviceToken(user.id, fcmToken, platform || 'web', deviceId, deviceName);
  }

  const accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  const refreshToken = jwt.sign({ id: user.id, role: user.role }, REFRESH_SECRET, { expiresIn: '30d' });
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
    profileCompletion: completion.profileCompletion,
    isProfileComplete: completion.isProfileComplete,
    subscriptionStatus: subscriptionGate.status,
    subscriptionPlanId: subscriptionGate.planId,
    subscriptionPlan: subscriptionGate.planName ?? subscriptionGate.planId,
    redirectTo: getRedirectTo(user.role),
  };

  return { accessToken, refreshToken, user: userData };
};

const ensureRoleProfile = async (userId: string, role: string) => {
  if (role === 'freelancer') {
    await prisma.freelancerProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  } else if (role === 'client') {
    await prisma.clientProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  } else if (role === 'investor') {
    await prisma.investorProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  } else if (role === 'founder') {
    await prisma.founderProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  }
};

const findOrCreateSocialUser = async (
  email: string,
  fullName: string,
  role: string,
  avatarUrl?: string
) => {
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          fullName,
          role,
          status: 'active',
          isVerified: true,
          avatarUrl: avatarUrl || null,
        },
      });
      await bootstrapNewUser(created.id, role, tx);
      return created;
    });
  } else {
    if (user.status !== 'active') {
      throw new Error('ACCOUNT_INACTIVE');
    }
    // Existing accounts keep their role; only ensure profile row exists.
    await ensureRoleProfile(user.id, user.role);
    await bootstrapUserResources(user.id);
    if (!user.avatarUrl && avatarUrl) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
      });
    }
  }
  return user;
};

const validateSocialBody = (body: Record<string, unknown>) => {
  const { role } = body;
  if (!role || typeof role !== 'string' || !isValidRole(role)) {
    return errorResponse('A valid role is required', 'VALIDATION_ERROR');
  }
  return null;
};

const mapSocialError = (error: unknown, provider: 'google' | 'apple') => {
  if (!(error instanceof Error)) return null;
  switch (error.message) {
    case 'INVALID_GOOGLE_TOKEN':
    case 'INVALID_APPLE_TOKEN':
      return errorResponse(
        `Invalid ${provider === 'google' ? 'Google' : 'Apple'} token`,
        'SOCIAL_AUTH_FAILED'
      );
    case 'GOOGLE_EMAIL_UNAVAILABLE':
    case 'APPLE_EMAIL_UNAVAILABLE':
      return errorResponse(
        `${provider === 'google' ? 'Google' : 'Apple'} account email not available`,
        'SOCIAL_AUTH_FAILED'
      );
    case 'ACCOUNT_INACTIVE':
      return errorResponse('Your account is inactive. Please contact support.', 'ACCOUNT_INACTIVE');
    case 'APPLE_KEYS_UNAVAILABLE':
      return errorResponse('Unable to verify Apple Sign-In right now', 'SOCIAL_AUTH_FAILED');
    default:
      return null;
  }
};

export const googleSocialLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, role, deviceId, deviceName, platform, fcmToken, email, fullName } = req.body;
    const roleError = validateSocialBody(req.body);
    if (roleError) return res.status(422).json(roleError);
    if (!idToken) {
      return res.status(422).json(errorResponse('Google token is required', 'VALIDATION_ERROR'));
    }

    const identity = await verifyGoogleIdToken(idToken);
    const user = await findOrCreateSocialUser(
      identity.email || email,
      fullName || identity.fullName || identity.email.split('@')[0],
      role,
      identity.picture
    );

    const tokens = await issueAuthResponse(user, deviceId, fcmToken, platform, deviceName);
    await AuditEngine.track(user.id, 'social_login', 'user', user.id, null, null, req);
    return res.json(successResponse('Google login successful', tokens));
  } catch (error: unknown) {
    const mapped = mapSocialError(error, 'google');
    if (mapped) {
      const status = (error as Error).message === 'ACCOUNT_INACTIVE' ? 403 : 401;
      return res.status(status).json(mapped);
    }
    next(error);
  }
};

export const appleSocialLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken, role, deviceId, deviceName, platform, fcmToken, email: fallbackEmail, fullName } = req.body;
    const roleError = validateSocialBody(req.body);
    if (roleError) return res.status(422).json(roleError);
    if (!idToken) {
      return res.status(422).json(errorResponse('Apple token is required', 'VALIDATION_ERROR'));
    }

    const identity = await verifyAppleIdToken(idToken, fallbackEmail);
    const user = await findOrCreateSocialUser(
      identity.email,
      fullName || identity.fullName || 'Apple User',
      role
    );

    const tokens = await issueAuthResponse(user, deviceId, fcmToken, platform, deviceName);
    await AuditEngine.track(user.id, 'social_login', 'user', user.id, null, null, req);
    return res.json(successResponse('Apple login successful', tokens));
  } catch (error: unknown) {
    const mapped = mapSocialError(error, 'apple');
    if (mapped) {
      const status = (error as Error).message === 'ACCOUNT_INACTIVE' ? 403 : 401;
      return res.status(status).json(mapped);
    }
    next(error);
  }
};
