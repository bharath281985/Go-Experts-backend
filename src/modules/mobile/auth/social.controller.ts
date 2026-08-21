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

  const hasActiveSubscription = subscriptionGate.status === 'active';

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
    subscriptionPlan: hasActiveSubscription,
    hasSubscription: hasActiveSubscription,
    isSubscribed: hasActiveSubscription,
    subscriptionStatus: subscriptionGate.status,
    subscriptionPlanId: subscriptionGate.planId,
    subscriptionPlanName: subscriptionGate.planName ?? subscriptionGate.planId,
  };

  return {
    accessToken,
    refreshToken,
    token: accessToken,
    subscriptionPlan: hasActiveSubscription,
    hasSubscription: hasActiveSubscription,
    isSubscribed: hasActiveSubscription,
    user: userData,
  };
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
  role?: string,
  avatarUrl?: string
) => {
  const cleanEmail = email ? email.trim().toLowerCase() : '';
  if (!cleanEmail) {
    throw new Error('Valid email is required for social authentication');
  }
  let isNewUser = false;
  let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) {
    if (!role || typeof role !== 'string' || !isValidRole(role)) {
      throw new Error('ROLE_REQUIRED_FOR_NEW_USER');
    }
    isNewUser = true;
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: cleanEmail,
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
  return { user, isNewUser };
};

const validateSocialBody = (body: Record<string, unknown>) => {
  const { role } = body;
  if (role !== undefined && (typeof role !== 'string' || !isValidRole(role))) {
    return errorResponse('A valid role is required when provided', 'VALIDATION_ERROR');
  }
  return null;
};

const mapSocialError = (error: unknown, provider: 'google' | 'apple') => {
  if (!(error instanceof Error)) return null;
  switch (error.message) {
    case 'ROLE_REQUIRED_FOR_NEW_USER':
      return errorResponse('Role is required for new users.', 'ROLE_REQUIRED');
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
    const { user, isNewUser } = await findOrCreateSocialUser(
      identity.email || email,
      fullName || identity.fullName || identity.email.split('@')[0],
      role,
      identity.picture
    );

    const tokens = await issueAuthResponse(user, deviceId, fcmToken, platform, deviceName);
    await AuditEngine.track(user.id, 'social_login', 'user', user.id, null, null, req);
    const message = isNewUser ? 'Account created successfully.' : 'Google login successful';
    return res.json(successResponse(message, { ...tokens, isNewUser }));
  } catch (error: unknown) {
    const mapped = mapSocialError(error, 'google');
    if (mapped) {
      let status = 401;
      const msg = (error as Error).message;
      if (msg === 'ACCOUNT_INACTIVE') status = 403;
      if (msg === 'ROLE_REQUIRED_FOR_NEW_USER') status = 400;
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
    const { user, isNewUser } = await findOrCreateSocialUser(
      identity.email,
      fullName || identity.fullName || 'Apple User',
      role
    );

    const tokens = await issueAuthResponse(user, deviceId, fcmToken, platform, deviceName);
    await AuditEngine.track(user.id, 'social_login', 'user', user.id, null, null, req);
    const message = isNewUser ? 'Account created successfully.' : 'Apple login successful';
    return res.json(successResponse(message, { ...tokens, isNewUser }));
  } catch (error: unknown) {
    const mapped = mapSocialError(error, 'apple');
    if (mapped) {
      let status = 401;
      const msg = (error as Error).message;
      if (msg === 'ACCOUNT_INACTIVE') status = 403;
      if (msg === 'ROLE_REQUIRED_FOR_NEW_USER') status = 400;
      return res.status(status).json(mapped);
    }
    next(error);
  }
};

export const appleSignInCallback = (req: Request, res: Response) => {
  // Apple sends the token data via POST (application/x-www-form-urlencoded)
  const { code, id_token, state, user } = req.body;

  const params = new URLSearchParams();
  if (code) params.append('code', String(code));
  if (id_token) params.append('id_token', String(id_token));
  if (state) params.append('state', String(state));
  if (user) params.append('user', String(user));

  // We are removing the strictly enforced package= parameter 
  // because if the Android app's build.gradle ID differs even slightly, it breaks.
  // Android will now aggressively fallback to ANY app answering to signinwithapple://callback
  const intentUrl = `intent://callback?${params.toString()}#Intent;scheme=signinwithapple;end`;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Apple Sign In Redirect</title>
      <style>
         body { font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f9f9f9;}
         .loader { border: 4px solid #f3f3f3; border-top: 4px solid #333; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; }
         @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
         .btn { display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h2>Authentication Successful!</h2>
      <div class="loader" id="loader"></div>
      
      <p style="margin-top: 20px;">If you are not redirected automatically...</p>
      
      <a href="${intentUrl}" class="btn">
        Click here to return to Go Experts
      </a>
      
      <script>
        // Attempt the automatic redirect first
        window.location.href = "${intentUrl}";
        
        setTimeout(function() {
          document.getElementById('loader').style.display = 'none';
        }, 1500);
      </script>
    </body>
    </html>
  `);
};
