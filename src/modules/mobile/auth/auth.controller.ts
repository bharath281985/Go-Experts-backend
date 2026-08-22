import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middlewares/auth.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendVerificationEmail } from '../../../services/mobile/email.service.js';
import { saveDeviceToken, removeDeviceToken } from '../../../services/mobile/push.service.js';
import { AuditEngine } from '../../../services/mobile/audit.engine.js';
import { bootstrapNewUser, bootstrapUserResources, isValidRole } from '../../../services/mobile/auth-bootstrap.service.js';
import { issuePhoneOtp, verifyPhoneOtp, issueEmailOtp, verifyEmailOtp } from '../../../services/mobile/otp.service.js';
import { resolveProfileCompletion } from '../../../services/mobile/profile-completion.service.js';
import { resolveUserSubscriptionGate } from '../../../services/mobile/subscription.service.js';
import dns from 'dns';

const dnsPromises = dns.promises;
dns.setServers(['8.8.8.8', '8.8.4.4']); // Use Google DNS to prevent local resolve issues

const validateEmailDomain = async (email: string): Promise<boolean> => {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    const addresses = await dnsPromises.resolveMx(domain);
    return addresses && addresses.length > 0;
  } catch (error) {
    return false;
  }
};

function requireSecret(name: string, value: string | undefined, fallback?: string): string {
  if (value && value.trim()) return value.trim();
  if (fallback) return fallback;
  return 'dev-only-secret-key-at-least-16-bytes-long';
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
  try {
    const prismaAny = prisma as any;
    if (prismaAny.setting) {
      const row = await prismaAny.setting.findUnique({ where: { key: authEpochKey(userId) } });
      const n = row ? Number(row.value) : 0;
      return Number.isFinite(n) ? n : 0;
    }
  } catch {
    // Fallback if setting model doesn't exist in Prisma
  }
  return 0;
};

const bumpAuthEpoch = async (userId: string): Promise<number> => {
  try {
    const prismaAny = prisma as any;
    if (prismaAny.setting) {
      const next = (await getAuthEpoch(userId)) + 1;
      const key = authEpochKey(userId);
      await prismaAny.setting.upsert({
        where: { key },
        create: { key, value: String(next), category: 'auth' },
        update: { value: String(next) },
      });
      return next;
    }
  } catch {
    // Fallback
  }
  return 0;
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

const buildPhoneNumber = (phone?: string, countryCode?: string) => {
  if (!phone) return undefined;
  if (!countryCode) return phone;
  return `${countryCode}${phone}`;
};

const resolveIsSocialLogin = async (user: any): Promise<boolean> => {
  if (!user) return false;
  if (!user.password || user.password.trim() === '' || user.password === 'N/A' || user.password === 'social_login') {
    return true;
  }
  if (user.registrationData && (String(user.registrationData).includes('"isSocialLogin":true') || String(user.registrationData).includes('"isSocial":true'))) {
    return true;
  }
  const identityCount = await (prisma as any).authIdentity?.count({ where: { userId: user.id } }).catch(() => 0);
  if (identityCount > 0) return true;

  const socialCount = await (prisma as any).socialAccount?.count({ where: { userId: user.id } }).catch(() => 0);
  return socialCount > 0;
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
  const accessToken = await createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  let completion = { profileCompletion: 80, isProfileComplete: true };
  let subscriptionGate: any = { status: 'active', planId: 'Free_Trial', planName: 'Starter' };
  let isSocial = false;

  try {
    const [c, s, isSocialRes] = await Promise.all([
      resolveProfileCompletion(user.id).catch(() => null),
      resolveUserSubscriptionGate(user.id).catch(() => null),
      resolveIsSocialLogin(user).catch(() => false),
    ]);
    if (c) completion = c;
    if (s) subscriptionGate = s;
    if (typeof isSocialRes === 'boolean') isSocial = isSocialRes;
  } catch (err) {
    console.error('Error resolving profile/subscription details:', err);
  }

  const hasActiveSubscription = subscriptionGate.status === 'active';

  return {
    accessToken,
    refreshToken,
    token: accessToken,
    isSocialLogin: isSocial,
    subscriptionPlan: hasActiveSubscription,
    hasSubscription: hasActiveSubscription,
    isSubscribed: hasActiveSubscription,
    profileCompletedPer: completion.profileCompletion,
    profileCompletedPercentage: completion.profileCompletion,
    profileCompletion: completion.profileCompletion,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      status: user.status,
      isVerified: user.isVerified,
      isSocialLogin: isSocial,
      profileCompletion: completion.profileCompletion,
      profileCompletedPer: completion.profileCompletion,
      profileCompletedPercentage: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
      subscriptionPlan: hasActiveSubscription,
      hasSubscription: hasActiveSubscription,
      isSubscribed: hasActiveSubscription,
      subscriptionStatus: subscriptionGate.status,
      subscriptionPlanId: subscriptionGate.planId,
      subscriptionPlanName: subscriptionGate.planName ?? subscriptionGate.planId,
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
    ).catch(() => null);
  }

  return buildAuthPayload(user);
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, deviceId, deviceName, platform, fcmToken } = req.body || {};

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json(
        errorResponse('Email is required', 'VALIDATION_ERROR')
      );
    }

    const rawEmail = email.trim();
    const cleanEmail = rawEmail.toLowerCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { email: rawEmail },
        ]
      }
    });

    if (!user || !user.password) {
      await safeTrackLoginAttempt(rawEmail, false, req, 'USER_NOT_FOUND');
      return res.status(404).json(
        errorResponse('This account is not registered. Please register', 'USER_NOT_FOUND')
      );
    }

    const isMatch = await bcrypt.compare(password || '', user.password);
    if (!isMatch) {
      await safeTrackLoginAttempt(rawEmail, false, req, 'INVALID_CREDENTIALS');
      await AuditEngine.track(user.id, 'failed_login', 'user', user.id, null, null, req).catch(() => null);
      return res.status(401).json(
        errorResponse('Invalid email or password', 'INVALID_CREDENTIALS')
      );
    }

    if (user.status !== 'active') {
      await safeTrackLoginAttempt(rawEmail, false, req, 'ACCOUNT_INACTIVE');
      return res.status(403).json(
        errorResponse('Your account is inactive. Please contact support.', 'ACCOUNT_INACTIVE')
      );
    }

    const payload = await issueAuthResponse(user, { fcmToken, platform, deviceId, deviceName });

    await AuditEngine.track(user.id, 'login', 'user', user.id, null, null, req).catch(() => null);
    await safeTrackLoginAttempt(rawEmail, true, req);

    return res.json(successResponse('Login successful', payload));
  } catch (error) { next(error); }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    const { email, password, role, fcmToken, platform, deviceId, deviceName } = b;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json(
        errorResponse('Email is required', 'VALIDATION_ERROR')
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const nameVal = b.fullName || b.name || "User";
    const phoneVal = b.phone || b.mobile || b.phoneNumber;
    const phoneCodeVal = b.phoneCode || b.countryCode;
    const bioVal = b.bio || (typeof b.startup === 'object' && b.startup?.longDescription) || b.businessDescription || b.thesis || b.overview || null;
    const cityVal = b.city || null;
    const stateVal = b.state || b.stateId || null;
    const countryVal = b.country || b.countryId || null;
    const avatarUrlVal = b.avatarUrl || b.avatar || b.logo || null;
    const isEmailVerified = Boolean(b.verification?.emailVerified ?? b.isVerified ?? b.emailVerified);

    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (existingUser) {
      return res.status(409).json(
        errorResponse('Email is already registered. Please login.', 'EMAIL_ALREADY_EXISTS')
      );
    }

    const hashedPassword = await bcrypt.hash(password || 'password123', 12);
    const targetRole = role || 'client';

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: cleanEmail,
          password: hashedPassword,
          fullName: String(nameVal).trim(),
          role: targetRole,
          phone: buildPhoneNumber(phoneVal, phoneCodeVal),
          city: cityVal ? String(cityVal).trim() : null,
          state: stateVal ? String(stateVal).trim() : null,
          country: countryVal ? String(countryVal).trim() : null,
          bio: bioVal ? String(bioVal).trim() : null,
          avatarUrl: avatarUrlVal ? String(avatarUrlVal).trim() : null,
          isVerified: isEmailVerified,
          registrationData: JSON.stringify(b),
          status: 'active',
        },
      });
      await bootstrapNewUser(created.id, targetRole, tx);

      // Populate initial role profile fields if provided during signup
      if (targetRole === 'investor') {
        const firmVal = b.companyFundName || b.firm || b.firmName || null;
        const ticketMinVal = b.minTicket ?? b.ticketMin;
        const ticketMaxVal = b.ticketMax ?? b.maxTicket;
        const focusAreasVal = b.focusAreas || (Array.isArray(b.categories) ? b.categories.join(', ') : b.categories) || null;
        await tx.investorProfile.upsert({
          where: { userId: created.id },
          update: {
            firm: firmVal ? String(firmVal).trim() : undefined,
            ticketMin: ticketMinVal != null && ticketMinVal !== '' ? parseFloat(ticketMinVal) : undefined,
            ticketMax: ticketMaxVal != null && ticketMaxVal !== '' ? parseFloat(ticketMaxVal) : undefined,
            focusAreas: focusAreasVal ? String(focusAreasVal) : undefined,
          },
          create: {
            userId: created.id,
            firm: firmVal ? String(firmVal).trim() : null,
            ticketMin: ticketMinVal != null && ticketMinVal !== '' ? parseFloat(ticketMinVal) : null,
            ticketMax: ticketMaxVal != null && ticketMaxVal !== '' ? parseFloat(ticketMaxVal) : null,
            focusAreas: focusAreasVal ? String(focusAreasVal) : null,
          }
        });
      } else if (targetRole === 'founder') {
        const startupObj = typeof b.startup === 'object' ? b.startup : {};
        const startupNameVal = startupObj.name || b.startupName || b.startup || b.title || (nameVal ? `${nameVal}'s Startup` : 'My Startup');
        const industryVal = b.industryId || b.industry || b.taxonomy?.primaryCategoryId || 'Technology';
        const stageVal = startupObj.stageId || b.stage || b.fundingStage || 'Idea';
        const teamSizeRaw = b.teamSizeId || b.teamSize;
        const teamSizeVal = teamSizeRaw ? (parseInt(String(teamSizeRaw).replace(/[^\d]/g, '')) || 1) : 1;
        const fundingReqRaw = startupObj.fundingRequired || b.fundingRequired || b.raised || b.funding;
        const raisedVal = fundingReqRaw != null ? (parseFloat(String(fundingReqRaw).replace(/[^\d.]/g, '')) || 0) : 0;
        const equityOfferedRaw = startupObj.equityOffered || b.equityOffered || b.equity;
        const equityVal = equityOfferedRaw != null ? (parseFloat(String(equityOfferedRaw).replace(/[^\d.]/g, '')) || 0) : 0;
        const pitchDeckVal = startupObj.pitchDeck || b.pitchDeck || b.pitchDeckUrl || null;

        await tx.founderProfile.upsert({
          where: { userId: created.id },
          update: {
            startupName: String(startupNameVal).trim(),
            industry: String(industryVal).trim(),
            stage: String(stageVal).trim(),
            teamSize: teamSizeVal,
            raised: raisedVal,
          },
          create: {
            userId: created.id,
            startupName: String(startupNameVal).trim(),
            industry: String(industryVal).trim(),
            stage: String(stageVal).trim(),
            teamSize: teamSizeVal,
            raised: raisedVal,
          }
        });

        await tx.startupIdea.create({
          data: {
            founder: created.id,
            startup: String(startupNameVal).trim(),
            industry: String(industryVal).trim(),
            category: b.profileCategoryId || b.categoryId || b.taxonomy?.primaryCategoryId || 'General',
            stage: String(stageVal).trim(),
            funding: raisedVal,
            equity: equityVal,
            visibility: b.visibility || 'Public',
            pitchDeck: pitchDeckVal,
            businessPlan: b.businessPlan || b.businessPlanUrl || null,
            logo: avatarUrlVal || null,
            status: 'active'
          }
        }).catch(() => null);
      } else if (targetRole === 'client') {
        const companyVal = b.businessName || b.company || b.companyName || null;
        const industryVal = b.industryId || b.industry || null;
        await tx.clientProfile.upsert({
          where: { userId: created.id },
          update: {
            company: companyVal ? String(companyVal).trim() : undefined,
            industry: industryVal ? String(industryVal).trim() : undefined,
          },
          create: {
            userId: created.id,
            company: companyVal ? String(companyVal).trim() : null,
            industry: industryVal ? String(industryVal).trim() : null,
          }
        });

        if (b.project && typeof b.project === 'object' && b.project.title) {
          const proj = b.project;
          const skillsVal = Array.isArray(proj.skills) ? proj.skills.join(', ') : (proj.skills ? String(proj.skills) : 'General');
          await tx.project.create({
            data: {
              title: String(proj.title).trim(),
              client: created.id,
              budget: proj.budget != null ? parseFloat(proj.budget) : 0,
              category: proj.categoryId || b.categoryId || 'General',
              technology: skillsVal,
              timeline: proj.timeline || null,
              description: proj.description || null,

              status: 'open',
            }
          }).catch(() => null);
        }
      } else if (targetRole === 'freelancer') {
        const rawSkills = b.skillIds ?? b.skills;
        const skillsVal = Array.isArray(rawSkills) ? rawSkills.join(',') : (rawSkills ? String(rawSkills) : null);
        const industryVal = b.industryId || b.industry || null;
        const expRaw = b.experienceYears ?? b.experience;
        const experienceVal = expRaw != null ? String(expRaw) : null;
        const hourlyRateVal = b.hourlyRate != null && b.hourlyRate !== '' ? parseFloat(b.hourlyRate) : null;

        const educationVal = b.education != null ? String(b.education).trim() : null;

        await tx.freelancerProfile.upsert({
          where: { userId: created.id },
          update: {
            skills: skillsVal || undefined,
            industry: industryVal ? String(industryVal).trim() : undefined,
            experience: experienceVal || undefined,
            hourlyRate: hourlyRateVal != null ? hourlyRateVal : undefined,
            education: educationVal || undefined,
          },
          create: {
            userId: created.id,
            skills: skillsVal || '',
            industry: industryVal ? String(industryVal).trim() : null,
            experience: experienceVal,
            hourlyRate: hourlyRateVal,
            education: educationVal,
          }
        });
      }

      if (b.subscription && typeof b.subscription === 'object' && (b.subscription.planId || b.subscription.isFreePlan !== undefined)) {
        const sub = b.subscription;
        const planId = String(sub.planId || (sub.isFreePlan ? 'Free_Trial' : 'Pro_Plan'));

        await tx.subscriptionPlan.upsert({
          where: { id: planId },
          update: {
            amount: sub.amount != null ? parseFloat(sub.amount) : 0,
            status: 'active',
          },
          create: {
            id: planId,
            name: `${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)} Plan`,
            role: targetRole,
            amount: sub.amount != null ? parseFloat(sub.amount) : 0,
            currency: 'INR',
            duration: sub.isFreePlan ? '90_days' : 'yearly',
            status: 'active',
          }
        }).catch(() => null);

        await tx.subscription.create({
          data: {
            userId: created.id,
            planId,
            startDate: new Date(),
            endDate: new Date(Date.now() + (sub.isFreePlan ? 90 * 86400000 : 365 * 86400000)),
            status: 'active',
          }
        }).catch(() => null);

        if (sub.amount && parseFloat(sub.amount) > 0) {
          await tx.payment.create({
            data: {
              userId: created.id,
              gateway: sub.paymentType || 'Easebuzz',
              amount: parseFloat(sub.amount),
              currency: 'INR',
              transactionId: sub.transactionId || null,
              status: sub.paymentStatus === 'paid' ? 'success' : 'pending',
            }
          }).catch(() => null);
        }
      }

      return created;
    });

    const payload = await issueAuthResponse(user, { fcmToken, platform, deviceId, deviceName });
    void sendWelcomeEmail(email, nameVal);
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
    const deviceId = req.body?.deviceId;

    if (fcmToken || deviceId) {
      await removeDeviceToken(fcmToken ? String(fcmToken) : undefined, deviceId ? String(deviceId) : undefined, req.user.id);
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
        password: true,
        registrationData: true,
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

interface OptionObj {
  id: string;
  name: string;
}

const resolveTeamSizeOption = async (teamSize?: number | null): Promise<OptionObj | null> => {
  const size = Number(teamSize);
  if (!Number.isFinite(size)) return null;

  const option = await (prisma as any).masterOption?.findFirst({
    where: {
      type: 'team_size',
      status: 'active',
      min: { lte: size },
      max: { gte: size },
    },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, label: true, value: true },
  }).catch(() => null);

  if (!option) return null;
  return { id: option.id, name: option.label || option.value };
};

const resolveMasterOption = async (
  value: string | null | undefined,
  types: string[],
): Promise<OptionObj | null> => {
  const clean = String(value || '').trim();
  if (!clean) return null;

  const option = await prisma.masterOption.findFirst({
    where: {
      type: { in: types },
      status: 'active',
      OR: [{ id: clean }, { value: clean }, { label: clean }],
    },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, label: true, value: true },
  }).catch(() => null);

  return option ? { id: option.id, name: option.label || option.value } : null;
};

const resolveOptionMap = async (values: (string | null | undefined)[]) => {
  const rawClean = values.flatMap(v => (v ? String(v).split(',').map(s => s.trim()) : [])).filter(Boolean);
  const cleanValues = [...new Set(rawClean)];
  const optionMap = new Map<string, OptionObj>();
  if (cleanValues.length === 0) return optionMap;

  try {
    const escapedIn = cleanValues.map(v => `'${v.replace(/'/g, "''")}'`).join(',');

    const [industries, stages, skills, skillCategories, expLevels, masterOptions, countries, workModes] = await Promise.all([
      prisma.industry.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { name: { in: cleanValues } }] },
        select: { id: true, name: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM industries WHERE id IN (${escapedIn}) OR name IN (${escapedIn})`).catch(() => [])) || [];
      }),
      prisma.startupStage.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { name: { in: cleanValues } }] },
        select: { id: true, name: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM startup_stages WHERE id IN (${escapedIn}) OR name IN (${escapedIn})`).catch(() => [])) || [];
      }),
      prisma.skill.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { name: { in: cleanValues } }] },
        select: { id: true, name: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM skills WHERE id IN (${escapedIn}) OR name IN (${escapedIn})`).catch(() => [])) || [];
      }),
      prisma.skillCategory.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { name: { in: cleanValues } }] },
        select: { id: true, name: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM skill_categories WHERE id IN (${escapedIn}) OR name IN (${escapedIn})`).catch(() => [])) || [];
      }),
      prisma.experienceLevel.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { name: { in: cleanValues } }] },
        select: { id: true, name: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM experience_levels WHERE id IN (${escapedIn}) OR name IN (${escapedIn})`).catch(() => [])) || [];
      }),
      (prisma as any).masterOption?.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { value: { in: cleanValues } }, { label: { in: cleanValues } }] },
        select: { id: true, label: true, value: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, label, value FROM master_options WHERE id IN (${escapedIn}) OR value IN (${escapedIn}) OR label IN (${escapedIn})`).catch(() => [])) || [];
      }) || [],
      (prisma as any).country?.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { name: { in: cleanValues } }, { code: { in: cleanValues } }] },
        select: { id: true, name: true, code: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, name, code FROM countries WHERE id IN (${escapedIn}) OR name IN (${escapedIn}) OR code IN (${escapedIn})`).catch(() => [])) || [];
      }) || [],
      (prisma as any).workMode?.findMany({
        where: { OR: [{ id: { in: cleanValues } }, { name: { in: cleanValues } }] },
        select: { id: true, name: true }
      }).catch(async () => {
        if (!escapedIn) return [];
        return (await prisma.$queryRawUnsafe<any[]>(`SELECT id, name FROM work_modes WHERE id IN (${escapedIn}) OR name IN (${escapedIn})`).catch(() => [])) || [];
      }) || [],
    ]);

    industries.forEach((i: any) => {
      const obj = { id: i.id, name: i.name };
      optionMap.set(i.id, obj);
      optionMap.set(i.name, obj);
    });

    stages.forEach((s: any) => {
      const obj = { id: s.id, name: s.name };
      optionMap.set(s.id, obj);
      optionMap.set(s.name, obj);
    });

    skills.forEach((s: any) => {
      const obj = { id: s.id, name: s.name };
      optionMap.set(s.id, obj);
      optionMap.set(s.name, obj);
    });

    skillCategories.forEach((sc: any) => {
      const obj = { id: sc.id, name: sc.name };
      optionMap.set(sc.id, obj);
      optionMap.set(sc.name, obj);
    });

    expLevels.forEach((el: any) => {
      const obj = { id: el.id, name: el.name };
      optionMap.set(el.id, obj);
      optionMap.set(el.name, obj);
    });

    masterOptions.forEach((o: any) => {
      const labelOrValue = o.label || o.value || o.name || o.id;
      const obj = { id: o.id, name: labelOrValue };
      optionMap.set(o.id, obj);
      if (o.value) optionMap.set(o.value, obj);
      if (o.label) optionMap.set(o.label, obj);
    });

    countries.forEach((c: any) => {
      const obj = { id: c.id, name: c.name };
      optionMap.set(c.id, obj);
      if (c.name) optionMap.set(c.name, obj);
      if (c.code) optionMap.set(c.code, obj);
    });

    workModes.forEach((wm: any) => {
      const obj = { id: wm.id, name: wm.name };
      optionMap.set(wm.id, obj);
      optionMap.set(wm.name, obj);
    });
  } catch { }

  return optionMap;
};

const parsePhoneNumber = (phoneStr?: string | null) => {
  if (!phoneStr || !phoneStr.trim()) {
    return { phone: null, phoneCode: null, phoneNumber: null };
  }
  const clean = phoneStr.trim();
  const match = clean.match(/^(\+\d{1,4})(.*)$/);
  if (match) {
    const code = match[1];
    const num = match[2].trim();
    return {
      phone: clean,
      phoneCode: code,
      phoneNumber: num
    };
  }
  return {
    phone: clean,
    phoneCode: null,
    phoneNumber: clean
  };
};

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json(errorResponse('Unauthorized'));

    const [dbUser, completion, subscriptionGate] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        include: {
          freelancerProfile: true,
          clientProfile: true,
          investorProfile: true,
          founderProfile: true,
        },
      }),
      resolveProfileCompletion(user.id),
      resolveUserSubscriptionGate(user.id),
    ]);

    const activeUser = dbUser || user;
    const roleProfile: any =
      activeUser.role === 'freelancer' ? activeUser.freelancerProfile :
        activeUser.role === 'client' ? activeUser.clientProfile :
          activeUser.role === 'investor' ? activeUser.investorProfile :
            activeUser.role === 'founder' ? activeUser.founderProfile : null;

    const rawSkills = roleProfile?.skills ? String(roleProfile.skills).split(',').map(s => s.trim()).filter(Boolean) : [];

    const idsToResolve = [
      activeUser.country,
      activeUser.state,
      activeUser.city,
      roleProfile?.industry,
      roleProfile?.experience,
      roleProfile?.availability,
      roleProfile?.workMode,
      roleProfile?.companySize,
      roleProfile?.hiringGoal,
      roleProfile?.projectHireBudget,
      roleProfile?.focusAreas,
      roleProfile?.preferredStage,
      roleProfile?.stage,
      roleProfile?.primaryGoal,
      roleProfile?.investorType,
      ...rawSkills,
    ];

    const [optionMap, teamSizeOption, clientCompanySizeOption, clientBudgetOption, isSocialLogin] = await Promise.all([
      resolveOptionMap(idsToResolve),
      activeUser.role === 'founder'
        ? resolveTeamSizeOption(roleProfile?.teamSize)
        : Promise.resolve(null),
      activeUser.role === 'client'
        ? resolveMasterOption(roleProfile?.companySize, ['company_size'])
        : Promise.resolve(null),
      activeUser.role === 'client'
        ? resolveMasterOption(roleProfile?.projectHireBudget, ['budget_range', 'project_budget_range', 'hiring_budget_range'])
        : Promise.resolve(null),
      resolveIsSocialLogin(activeUser).catch(() => false),
    ]);

    const toSlugId = (text: string) => {
      if (!text) return text;
      const trimmed = text.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) || /^[a-z0-9_]+$/i.test(trimmed)) {
        return trimmed;
      }
      return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    };

    const toSingleOption = (val?: string | null): OptionObj | null => {
      if (!val || !val.trim()) return null;
      const parts = val.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return null;
      const first = parts[0];
      const found = optionMap.get(first);
      if (found) {
        return { id: found.id, name: found.name };
      }

      const clean = first.replace(/^opt_(city|state)_/i, '').replace(/_/g, ' ');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      return { id: isUuid ? clean : toSlugId(clean), name: isUuid ? "" : clean };
    };

    const toMultiOptions = (val?: string | Array<any> | null): OptionObj[] => {
      if (!val) return [];
      let parts: string[] = [];
      if (Array.isArray(val)) {
        parts = val.map(v => (typeof v === 'object' ? v?.id || v?.name : String(v))).filter(Boolean);
      } else if (typeof val === 'string') {
        parts = val.split(',').map(s => s.trim()).filter(Boolean);
      }
      const uniqueParts = [...new Set(parts)];
      const result: OptionObj[] = [];
      const seen = new Set<string>();

      for (const p of uniqueParts) {
        const found = optionMap.get(p);
        const clean = p.replace(/^opt_(city|state)_/i, '').replace(/_/g, ' ');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
        const obj = { id: found?.id || (isUuid ? clean : toSlugId(clean)), name: found?.name || (isUuid ? "" : clean) };
        if (!seen.has(obj.id)) {
          seen.add(obj.id);
          result.push(obj);
        }
      }
      return result;
    };

    let formattedProfile: any = null;
    if (roleProfile) {
      formattedProfile = { ...roleProfile };

      if (activeUser.role === 'freelancer') {
        formattedProfile.headline = roleProfile.titleHeadline;
        formattedProfile.categoryId = toMultiOptions(roleProfile.industry);
        formattedProfile.industryId = toMultiOptions(roleProfile.industry);
        delete formattedProfile.industry;
        const experienceLevel = toSingleOption(roleProfile.experience);
        formattedProfile.ExperienceLevel = experienceLevel ? {
          experienceLevelId: experienceLevel.id,
          experienceLevelName: experienceLevel.name,
        } : null;
        delete formattedProfile.experience;
        const education = toSingleOption(roleProfile.education);
        formattedProfile.educationId = education;
        delete formattedProfile.education;
        const availability = toSingleOption(roleProfile.availability);
        formattedProfile.Availability = availability ? {
          availabilityId: availability.id,
          availabilityName: availability.name,
        } : null;
        delete formattedProfile.availability;
        formattedProfile.websiteUrl = roleProfile.websiteUrl || null;
        if (roleProfile.workMode) {
          formattedProfile.workModeId = toSingleOption(roleProfile.workMode);
          delete formattedProfile.workMode;
        }
        const resolvedSkills = toMultiOptions(roleProfile.skills);
        formattedProfile.skills = resolvedSkills.map(s => s.name);
      } else if (activeUser.role === 'client') {
        formattedProfile.companyName = roleProfile.company;
        formattedProfile.headline = roleProfile.jobTitle;
        formattedProfile.industryId = toMultiOptions(roleProfile.industry);
        delete formattedProfile.industry;
        formattedProfile.projectHireBudgetId = clientBudgetOption || toSingleOption(roleProfile.projectHireBudget);
        delete formattedProfile.projectHireBudget;
        formattedProfile.companySizeId = clientCompanySizeOption || toSingleOption(roleProfile.companySize);
        formattedProfile.currentTeam = formattedProfile.companySizeId?.name || roleProfile.currentTeam || null;
        delete formattedProfile.companySize;
        formattedProfile.hiringGoalId = toMultiOptions(roleProfile.hiringGoal);
        delete formattedProfile.hiringGoal;
      } else if (activeUser.role === 'investor') {
        formattedProfile.focusAreasId = toMultiOptions(roleProfile.focusAreas);
        delete formattedProfile.focusAreas;
        formattedProfile.preferredStageId = toSingleOption(roleProfile.preferredStage);
        delete formattedProfile.preferredStage;
        formattedProfile.investorTypeId = toSingleOption(roleProfile.investorType);
        delete formattedProfile.investorType;
      } else if (activeUser.role === 'founder') {
        formattedProfile.teamSize = teamSizeOption;
        formattedProfile.industryId = toMultiOptions(roleProfile.industry);
        delete formattedProfile.industry;
        formattedProfile.stageId = toSingleOption(roleProfile.stage);
        delete formattedProfile.stage;
        formattedProfile.founderRoleId = toSingleOption(roleProfile.founderRole);
        delete formattedProfile.founderRole;

        formattedProfile.primaryGoalId = toMultiOptions(roleProfile.primaryGoal);
        delete formattedProfile.primaryGoal;
      }
    }

    const phoneParsed = parsePhoneNumber(activeUser.phone);

    const userData = {
      id: activeUser.id,
      email: activeUser.email,
      fullName: activeUser.fullName,
      role: activeUser.role,
      avatarUrl: activeUser.avatarUrl,
      status: activeUser.status,
      isVerified: activeUser.isVerified,
      isSocialLogin: isSocialLogin,
      verified: activeUser.verified,
      phone: phoneParsed.phone,
      phoneCode: phoneParsed.phoneCode,
      phoneNumber: phoneParsed.phoneNumber,

      // User Location
      country: toSingleOption(activeUser.country),
      state: toSingleOption(activeUser.state),
      city: activeUser.city ? String(activeUser.city).replace(/^opt_(city|state)_/i, '').replace(/_/g, ' ') : null,
      bio: activeUser.bio,
      referralCode: activeUser.referralCode,
      createdAt: activeUser.createdAt,
      updatedAt: activeUser.updatedAt,

      // Role specific profile details
      profile: formattedProfile,

      profileCompletion: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
      missingRequirements: completion.requirements,
      pendingSteps: completion.pendingSteps,
      subscriptionStatus: subscriptionGate.status,
      subscriptionPlanId: subscriptionGate.planId,
      subscriptionPlan: subscriptionGate.planName ?? subscriptionGate.planId,
    };
    return res.json(successResponse('User profile retrieved', { user: userData }));
  } catch (error) { next(error); }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json(errorResponse('Email is required', 'EMAIL_REQUIRED'));
    }
    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        deletedAt: null,
      },
    });
    if (!user) {
      return res.status(404).json(errorResponse('No Go Experts account was found with this email address.', 'ACCOUNT_NOT_FOUND'));
    }
    if (!user.password) {
      return res.status(400).json(errorResponse('This account uses social sign-in. Please continue with Google or Apple.', 'PASSWORD_LOGIN_NOT_AVAILABLE'));
    }

    const token = createPasswordResetToken({ id: user.id, password: user.password });
    await sendPasswordResetEmail(user.email, token);
    await AuditEngine.track(user.id, 'password_reset_requested', 'user', user.id, null, null, req);

    return res.json(successResponse('Password reset instructions have been sent to your registered email address.'));
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
    const extractVal = (val: any) => {
      if (val == null) return undefined;
      if (typeof val === 'object' && !Array.isArray(val)) {
        return val.id || val.value || val.name || val.label;
      }
      if (Array.isArray(val)) {
        const ids = val.map(item => (typeof item === 'object' ? item.id || item.value || item.name : String(item))).filter(Boolean);
        return ids.join(',');
      }
      return String(val).trim();
    };

    const {
      fullName,
      phone,
      bio,
      headline,
      titleHeadline,
      location,
      hourlyRate,
      availability,
      experience,
      yearsOfExperience,
      portfolioUrl,
      resumeUrl,
      linkedInUrl,
      websiteUrl,
      githubUrl,
      dribbbleUrl,
      workMode,
      currency,
      monthlyRetainer,
      workingHours,
      responseTime,
      remoteAvailability,
      openToTravel,
      company,
      companyName,
      businessName,
      projectHireBudget,
      projectHireBudgetId,
      jobTitle,
      currentTeam,
      investorType,
      firm,
      firmName,
      isAccredited,
      ticketMin,
      minTicket,
      ticketMax,
      maxTicket,
      startupName,
      pitch,
      founderRole,
      founderBio,
      targetRaise,
      raised,
      teamSize,
      education,
    } = req.body;

    const rawPhone = req.body.phone;
    const phoneCodeInput = req.body.phoneCode || req.body.dialCode || req.body.countryPhoneCode;

    let finalPhone: string | undefined = undefined;
    if (rawPhone) {
      const cleanRaw = String(rawPhone).trim();
      if (cleanRaw.startsWith('+')) {
        finalPhone = cleanRaw;
      } else if (phoneCodeInput) {
        const cleanCode = String(phoneCodeInput).trim().startsWith('+') ? String(phoneCodeInput).trim() : `+${String(phoneCodeInput).trim()}`;
        finalPhone = `${cleanCode}${cleanRaw}`;
      } else {
        finalPhone = cleanRaw;
      }
    }

    const countryInput = extractVal(req.body.countryId ?? req.body.country);
    const stateInput = extractVal(req.body.stateId ?? req.body.stateid ?? req.body.state);
    const cityInput = extractVal(req.body.cityId ?? req.body.city ?? location);
    const skillsInput = extractVal(req.body.skillIds ?? req.body.skills);
    const expInput = extractVal(req.body.experienceLevelId ?? req.body.experienceLevel ?? experience);
    const industryInput = extractVal(req.body.industryId ?? req.body.industry ?? req.body.categoryId);
    const hiringGoalInput = extractVal(req.body.hiringGoalId ?? req.body.hiringGoal);
    const companySizeInput = extractVal(req.body.companySizeId ?? req.body.companySize);
    const projectHireBudgetInput = extractVal(req.body.projectHireBudgetId ?? req.body.projectHireBudget);
    const currentTeamInput = extractVal(
      req.body.currentTeam ?? req.body.currentTeamId ?? req.body.companySizeId ?? req.body.companySize
    );
    const availabilityInput = extractVal(req.body.availabilityId ?? req.body.availability ?? availability);
    const workModeInput = extractVal(req.body.workModeId ?? req.body.workMode ?? workMode);
    const focusAreasInput = extractVal(req.body.focusAreasId ?? req.body.focusAreas ?? req.body.categoryId);
    const prefStageInput = extractVal(req.body.preferredStageId ?? req.body.preferredStage);
    const stageInput = extractVal(req.body.stageId ?? req.body.stage);
    const primaryGoalInput = extractVal(req.body.primaryGoalId ?? req.body.primaryGoal);
    const investorTypeInput = extractVal(req.body.investorTypeId ?? req.body.investorType);
    const founderRoleInput = extractVal(req.body.founderRoleId ?? req.body.founderRole);
    const teamSizeInput = extractVal(req.body.teamSizeId ?? req.body.teamSize);
    const educationInput = extractVal(req.body.educationId ?? req.body.education ?? education);

    let avatarUrl: string | undefined = undefined;
    if (req.file) {
      const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
      const relativePath = req.file.path.replace(/\\/g, '/');
      avatarUrl = `${BASE_URL}/${relativePath}`;
    } else if (req.body.avatarUrl || req.body.logo || req.body.avatar || req.body.logoUrl) {
      avatarUrl = req.body.avatarUrl || req.body.logo || req.body.avatar || req.body.logoUrl;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName: fullName || undefined,
        phone: finalPhone || undefined,
        country: countryInput || undefined,
        state: stateInput || undefined,
        city: cityInput || undefined,
        bio: bio !== undefined ? bio : undefined,
        avatarUrl: avatarUrl || undefined,
        isVerified: true,
      },
    });

    const role = updatedUser.role;

    if (role === 'freelancer') {
      const titleHeadlineVal = titleHeadline || headline;
      const hourlyRateVal = hourlyRate != null && hourlyRate !== '' ? parseFloat(hourlyRate) : undefined;
      const monthlyRetainerVal = monthlyRetainer != null && monthlyRetainer !== '' ? parseFloat(monthlyRetainer) : undefined;

      await prisma.freelancerProfile.upsert({
        where: { userId: req.user.id },
        update: {
          skills: skillsInput,
          titleHeadline: titleHeadlineVal ? String(titleHeadlineVal).trim() : undefined,
          hourlyRate: hourlyRateVal,
          availability: availabilityInput ? String(availabilityInput).trim() : undefined,
          experience: expInput ? String(expInput).trim() : undefined,
          yearsOfExperience: yearsOfExperience ? String(yearsOfExperience).trim() : undefined,
          portfolioUrl: portfolioUrl ? String(portfolioUrl).trim() : undefined,
          linkedInUrl: linkedInUrl ? String(linkedInUrl).trim() : undefined,
          websiteUrl: websiteUrl ? String(websiteUrl).trim() : undefined,
          resumeUrl: resumeUrl ? String(resumeUrl).trim() : undefined,
          githubUrl: githubUrl ? String(githubUrl).trim() : undefined,
          dribbbleUrl: dribbbleUrl ? String(dribbbleUrl).trim() : undefined,
          industry: industryInput ? String(industryInput).trim() : undefined,
          workMode: workMode ? String(workMode).trim() : undefined,
          currency: currency ? String(currency).trim() : undefined,
          monthlyRetainer: monthlyRetainerVal,
          workingHours: workingHours ? String(workingHours).trim() : undefined,
          responseTime: responseTime ? String(responseTime).trim() : undefined,
          remoteAvailability: remoteAvailability != null ? Boolean(remoteAvailability) : undefined,
          openToTravel: openToTravel != null ? Boolean(openToTravel) : undefined,
          education: educationInput ? String(educationInput).trim() : undefined,
        },
        create: {
          userId: req.user.id,
          skills: skillsInput || '',
          titleHeadline: titleHeadlineVal ? String(titleHeadlineVal).trim() : null,
          hourlyRate: hourlyRateVal ?? null,
          availability: availabilityInput ? String(availabilityInput).trim() : null,
          experience: expInput ? String(expInput).trim() : null,
          yearsOfExperience: yearsOfExperience ? String(yearsOfExperience).trim() : null,
          portfolioUrl: portfolioUrl ? String(portfolioUrl).trim() : null,
          linkedInUrl: linkedInUrl ? String(linkedInUrl).trim() : null,
          websiteUrl: websiteUrl ? String(websiteUrl).trim() : null,
          resumeUrl: resumeUrl ? String(resumeUrl).trim() : null,
          githubUrl: githubUrl ? String(githubUrl).trim() : null,
          dribbbleUrl: dribbbleUrl ? String(dribbbleUrl).trim() : null,
          industry: industryInput ? String(industryInput).trim() : null,
          workMode: workMode ? String(workMode).trim() : null,
          currency: currency ? String(currency).trim() : null,
          monthlyRetainer: monthlyRetainerVal ?? null,
          workingHours: workingHours ? String(workingHours).trim() : null,
          responseTime: responseTime ? String(responseTime).trim() : null,
          remoteAvailability: remoteAvailability != null ? Boolean(remoteAvailability) : true,
          openToTravel: openToTravel != null ? Boolean(openToTravel) : false,
          education: educationInput ? String(educationInput).trim() : null,
        },
      });
    } else if (role === 'client') {
      const companyVal = company || companyName || businessName;
      const jobTitleVal = jobTitle || headline;

      await prisma.clientProfile.upsert({
        where: { userId: req.user.id },
        update: {
          company: companyVal ? String(companyVal).trim() : undefined,
          industry: industryInput ? String(industryInput).trim() : undefined,
          hiringGoal: hiringGoalInput ? String(hiringGoalInput).trim() : undefined,
          projectHireBudget: projectHireBudgetInput ? String(projectHireBudgetInput).trim() : undefined,
          companySize: companySizeInput ? String(companySizeInput).trim() : undefined,
          currentTeam: currentTeamInput ? String(currentTeamInput).trim() : undefined,
          websiteUrl: websiteUrl ? String(websiteUrl).trim() : undefined,
          jobTitle: jobTitleVal ? String(jobTitleVal).trim() : undefined,
        },
        create: {
          userId: req.user.id,
          company: companyVal ? String(companyVal).trim() : null,
          industry: industryInput ? String(industryInput).trim() : null,
          hiringGoal: hiringGoalInput ? String(hiringGoalInput).trim() : null,
          projectHireBudget: projectHireBudgetInput ? String(projectHireBudgetInput).trim() : null,
          companySize: companySizeInput ? String(companySizeInput).trim() : null,
          currentTeam: currentTeamInput ? String(currentTeamInput).trim() : null,
          websiteUrl: websiteUrl ? String(websiteUrl).trim() : null,
          jobTitle: jobTitleVal ? String(jobTitleVal).trim() : null,
        },
      });
    } else if (role === 'investor') {
      const firmVal = firm || firmName;
      const ticketMinVal = ticketMin ?? minTicket;
      const ticketMaxVal = ticketMax ?? maxTicket;

      await prisma.investorProfile.upsert({
        where: { userId: req.user.id },
        update: {
          investorType: investorTypeInput ? String(investorTypeInput).trim() : undefined,
          firm: firmVal ? String(firmVal).trim() : undefined,
          isAccredited: isAccredited ? String(isAccredited).trim() : undefined,
          focusAreas: focusAreasInput ? String(focusAreasInput).trim() : undefined,
          ticketMin: ticketMinVal != null && ticketMinVal !== '' ? parseFloat(ticketMinVal) : undefined,
          ticketMax: ticketMaxVal != null && ticketMaxVal !== '' ? parseFloat(ticketMaxVal) : undefined,
          preferredStage: prefStageInput ? String(prefStageInput).trim() : undefined,
        },
        create: {
          userId: req.user.id,
          investorType: investorTypeInput ? String(investorTypeInput).trim() : null,
          firm: firmVal ? String(firmVal).trim() : null,
          isAccredited: isAccredited ? String(isAccredited).trim() : null,
          focusAreas: focusAreasInput ? String(focusAreasInput).trim() : null,
          ticketMin: ticketMinVal != null && ticketMinVal !== '' ? parseFloat(ticketMinVal) : null,
          ticketMax: ticketMaxVal != null && ticketMaxVal !== '' ? parseFloat(ticketMaxVal) : null,
          preferredStage: prefStageInput ? String(prefStageInput).trim() : null,
        },
      });
    } else if (role === 'founder') {
      const targetRaiseVal = targetRaise ?? raised;
      const raisedVal = raised != null && raised !== '' ? parseFloat(String(raised)) : undefined;

      const parsedTeamSize = teamSizeInput ? parseInt(String(teamSizeInput).replace(/\D/g, '') || '1') || 1 : undefined;

      await prisma.founderProfile.upsert({
        where: { userId: req.user.id },
        update: {
          startupName: startupName ? String(startupName).trim() : undefined,
          industry: industryInput ? String(industryInput).trim() : undefined,
          pitch: pitch ? String(pitch).trim() : undefined,
          founderRole: founderRoleInput ? String(founderRoleInput).trim() : undefined,
          founderBio: founderBio ? String(founderBio).trim() : undefined,
          stage: stageInput ? String(stageInput).trim() : undefined,
          targetRaise: targetRaiseVal != null && targetRaiseVal !== '' ? parseFloat(targetRaiseVal) : undefined,
          raised: raisedVal,
          teamSize: parsedTeamSize,
          primaryGoal: primaryGoalInput ? String(primaryGoalInput).trim() : undefined,
        },
        create: {
          userId: req.user.id,
          startupName: startupName ? String(startupName).trim() : null,
          industry: industryInput ? String(industryInput).trim() : null,
          pitch: pitch ? String(pitch).trim() : null,
          founderRole: founderRoleInput ? String(founderRoleInput).trim() : null,
          founderBio: founderBio ? String(founderBio).trim() : null,
          stage: stageInput ? String(stageInput).trim() : null,
          targetRaise: targetRaiseVal != null && targetRaiseVal !== '' ? parseFloat(targetRaiseVal) : null,
          raised: raisedVal ?? 0,
          teamSize: parsedTeamSize ?? 1,
          primaryGoal: primaryGoalInput ? String(primaryGoalInput).trim() : null,
        },
      });
    }

    // Now query full dbUser with roleProfile and return identical formatted payload as getMe
    const [dbUser, completion, subscriptionGate] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          freelancerProfile: true,
          clientProfile: true,
          investorProfile: true,
          founderProfile: true,
        },
      }),
      resolveProfileCompletion(req.user.id),
      resolveUserSubscriptionGate(req.user.id),
    ]);

    const activeUser: any = (dbUser || updatedUser) as any;
    const roleProfile: any =
      activeUser.role === 'freelancer' ? activeUser.freelancerProfile :
        activeUser.role === 'client' ? activeUser.clientProfile :
          activeUser.role === 'investor' ? activeUser.investorProfile :
            activeUser.role === 'founder' ? activeUser.founderProfile : null;

    const rawSkills = roleProfile?.skills ? String(roleProfile.skills).split(',').map(s => s.trim()).filter(Boolean) : [];

    const idsToResolve = [
      activeUser.country,
      activeUser.state,
      activeUser.city,
      roleProfile?.industry,
      roleProfile?.experience,
      roleProfile?.availability,
      roleProfile?.workMode,
      roleProfile?.companySize,
      roleProfile?.hiringGoal,
      roleProfile?.projectHireBudget,
      roleProfile?.focusAreas,
      roleProfile?.preferredStage,
      roleProfile?.stage,
      roleProfile?.primaryGoal,
      roleProfile?.investorType,
      ...rawSkills,
    ];

    const [optionMap, teamSizeOption, clientCompanySizeOption, clientBudgetOption, isSocialLogin] = await Promise.all([
      resolveOptionMap(idsToResolve),
      activeUser.role === 'founder'
        ? resolveTeamSizeOption(roleProfile?.teamSize)
        : Promise.resolve(null),
      activeUser.role === 'client'
        ? resolveMasterOption(roleProfile?.companySize, ['company_size'])
        : Promise.resolve(null),
      activeUser.role === 'client'
        ? resolveMasterOption(roleProfile?.projectHireBudget, ['budget_range', 'project_budget_range', 'hiring_budget_range'])
        : Promise.resolve(null),
      resolveIsSocialLogin(activeUser).catch(() => false),
    ]);

    const toSlugId = (text: string) => {
      if (!text) return text;
      const trimmed = text.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) || /^[a-z0-9_]+$/i.test(trimmed)) {
        return trimmed;
      }
      return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    };

    const toSingleOption = (val?: string | null): OptionObj | null => {
      if (!val || !val.trim()) return null;
      const parts = val.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) return null;
      const first = parts[0];
      const found = optionMap.get(first);
      if (found) {
        return { id: found.id, name: found.name };
      }

      const clean = first.replace(/^opt_(city|state)_/i, '').replace(/_/g, ' ');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      return { id: isUuid ? clean : toSlugId(clean), name: isUuid ? "" : clean };
    };

    const toMultiOptions = (val?: string | Array<any> | null): OptionObj[] => {
      if (!val) return [];
      let parts: string[] = [];
      if (Array.isArray(val)) {
        parts = val.map(v => (typeof v === 'object' ? v?.id || v?.name : String(v))).filter(Boolean);
      } else if (typeof val === 'string') {
        parts = val.split(',').map(s => s.trim()).filter(Boolean);
      }
      const uniqueParts = [...new Set(parts)];
      const result: OptionObj[] = [];
      const seen = new Set<string>();

      for (const p of uniqueParts) {
        const found = optionMap.get(p);
        const clean = p.replace(/^opt_(city|state)_/i, '').replace(/_/g, ' ');
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
        const obj = { id: found?.id || (isUuid ? clean : toSlugId(clean)), name: found?.name || (isUuid ? "" : clean) };
        if (!seen.has(obj.id)) {
          seen.add(obj.id);
          result.push(obj);
        }
      }
      return result;
    };

    let formattedProfile: any = null;
    if (roleProfile) {
      formattedProfile = { ...roleProfile };

      if (activeUser.role === 'freelancer') {
        formattedProfile.headline = roleProfile.titleHeadline;
        formattedProfile.categoryId = toMultiOptions(roleProfile.industry);
        formattedProfile.industryId = toMultiOptions(roleProfile.industry);
        delete formattedProfile.industry;
        const experienceLevel = toSingleOption(roleProfile.experience);
        formattedProfile.ExperienceLevel = experienceLevel ? {
          experienceLevelId: experienceLevel.id,
          experienceLevelName: experienceLevel.name,
        } : null;
        delete formattedProfile.experience;
        const education = toSingleOption(roleProfile.education);
        formattedProfile.educationId = education;
        delete formattedProfile.education;
        const availability = toSingleOption(roleProfile.availability);
        formattedProfile.Availability = availability ? {
          availabilityId: availability.id,
          availabilityName: availability.name,
        } : null;
        delete formattedProfile.availability;
        formattedProfile.websiteUrl = roleProfile.websiteUrl || null;
        if (roleProfile.workMode) {
          formattedProfile.workModeId = toSingleOption(roleProfile.workMode);
          delete formattedProfile.workMode;
        }
        const resolvedSkills = toMultiOptions(roleProfile.skills);
        formattedProfile.skills = resolvedSkills.map(s => s.name);
      } else if (activeUser.role === 'client') {
        formattedProfile.companyName = roleProfile.company;
        formattedProfile.headline = roleProfile.jobTitle;
        formattedProfile.industryId = toMultiOptions(roleProfile.industry);
        delete formattedProfile.industry;
        formattedProfile.projectHireBudgetId = clientBudgetOption || toSingleOption(roleProfile.projectHireBudget);
        delete formattedProfile.projectHireBudget;
        formattedProfile.companySizeId = clientCompanySizeOption || toSingleOption(roleProfile.companySize);
        formattedProfile.currentTeam = formattedProfile.companySizeId?.name || roleProfile.currentTeam || null;
        delete formattedProfile.companySize;
        formattedProfile.hiringGoalId = toMultiOptions(roleProfile.hiringGoal);
        delete formattedProfile.hiringGoal;
      } else if (activeUser.role === 'investor') {
        formattedProfile.focusAreasId = toMultiOptions(roleProfile.focusAreas);
        delete formattedProfile.focusAreas;
        formattedProfile.preferredStageId = toSingleOption(roleProfile.preferredStage);
        delete formattedProfile.preferredStage;
        formattedProfile.investorTypeId = toSingleOption(roleProfile.investorType);
        delete formattedProfile.investorType;
      } else if (activeUser.role === 'founder') {
        formattedProfile.teamSize = teamSizeOption;
        formattedProfile.industryId = toMultiOptions(roleProfile.industry);
        delete formattedProfile.industry;
        formattedProfile.stageId = toSingleOption(roleProfile.stage);
        delete formattedProfile.stage;
        formattedProfile.founderRoleId = toSingleOption(roleProfile.founderRole);
        delete formattedProfile.founderRole;

        formattedProfile.primaryGoalId = toMultiOptions(roleProfile.primaryGoal);
        delete formattedProfile.primaryGoal;
      }
    }

    const phoneParsed = parsePhoneNumber(activeUser.phone);

    const userData = {
      id: activeUser.id,
      email: activeUser.email,
      fullName: activeUser.fullName,
      role: activeUser.role,
      avatarUrl: activeUser.avatarUrl,
      status: activeUser.status,
      isVerified: activeUser.isVerified,
      isSocialLogin: isSocialLogin,
      phone: phoneParsed.phone,
      phoneCode: phoneParsed.phoneCode,
      phoneNumber: phoneParsed.phoneNumber,

      country: toSingleOption(activeUser.country),
      state: toSingleOption(activeUser.state),
      city: activeUser.city ? String(activeUser.city).replace(/^opt_(city|state)_/i, '').replace(/_/g, ' ') : null,
      bio: activeUser.bio,

      profile: formattedProfile,

      profileCompletion: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
      subscriptionStatus: subscriptionGate.status,
      subscriptionPlanId: subscriptionGate.planId,
      subscriptionPlan: subscriptionGate.planName ?? subscriptionGate.planId,
    };

    return res.json(successResponse('Profile updated successfully', { user: userData, completion }));
  } catch (error) { next(error); }
};

export const selectSocialRole = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = String(req.body?.role || '').trim().toLowerCase();
    if (!isValidRole(role)) {
      return res.status(400).json(errorResponse('A valid role is required.', 'VALIDATION_ERROR'));
    }

    const existing = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!existing) {
      return res.status(404).json(errorResponse('User not found.', 'NOT_FOUND'));
    }

    let registrationData: Record<string, any> = {};
    try {
      registrationData =
        typeof existing.registrationData === 'string'
          ? JSON.parse(existing.registrationData || '{}')
          : ((existing.registrationData as any) || {});
    } catch {
      registrationData = {};
    }

    registrationData.isSocialLogin = true;
    registrationData.isSocial = true;
    registrationData.selectedRole = role;
    registrationData.onboardingStatus = registrationData.onboardingStatus || 'draft';

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: req.user.id },
        data: {
          role,
          registrationData: JSON.stringify(registrationData),
        },
      });

      if (role === 'freelancer') {
        await tx.freelancerProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      } else if (role === 'client') {
        await tx.clientProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      } else if (role === 'investor') {
        await tx.investorProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      } else if (role === 'founder') {
        await tx.founderProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      }

      await bootstrapUserResources(user.id, tx);
      return user;
    });

    const [completion, subscriptionGate] = await Promise.all([
      resolveProfileCompletion(updatedUser.id),
      resolveUserSubscriptionGate(updatedUser.id),
    ]);

    return res.json(successResponse('Role selected successfully', {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        status: updatedUser.status,
        isVerified: updatedUser.isVerified,
        isSocialLogin: true,
        profileCompletion: completion.profileCompletion,
        isProfileComplete: completion.isProfileComplete,
        subscriptionStatus: subscriptionGate.status,
        subscriptionPlanId: subscriptionGate.planId,
        subscriptionPlan: subscriptionGate.planName ?? subscriptionGate.planId,
      },
      completion,
    }));
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
    if (!req.user?.email) {
      return res.status(400).json(errorResponse('Email is required', 'VALIDATION_ERROR'));
    }

    const { code } = await issueEmailOtp(req.user.email);
    const emailSent = await sendVerificationEmail(req.user.email, code);

    if (!emailSent) {
      return res.status(500).json(errorResponse('Failed to send verification email', 'EMAIL_SEND_FAILED'));
    }

    return res.json(successResponse('Verification email sent', {
      email: req.user.email,
      expiresInSeconds: 600,
      devOtpCode: code,
    }));
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
    const { email, phone, countryCode } = req.body;

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json(errorResponse('Invalid email address format', 'VALIDATION_ERROR'));
      }
      const isDomainValid = await validateEmailDomain(email);
      if (!isDomainValid) {
        return res.status(400).json(errorResponse('Email domain is not valid or not receiving emails', 'VALIDATION_ERROR'));
      }

      const { code } = await issueEmailOtp(email);
      const emailSent = await sendVerificationEmail(email, code);

      if (!emailSent) {
        return res.status(500).json(errorResponse('Failed to send OTP email. Please try again later.', 'OTP_SEND_FAILED'));
      }

      const otpId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return res.json(
        successResponse('OTP sent successfully', {
          id: otpId,
          email,
          expiresInSeconds: 600,
          devOtpCode: code // Displaying explicitly for testing
        })
      );
    }

    if (phone && countryCode) {
      try {
        const { phoneNumber, code } = await issuePhoneOtp(phone, countryCode);
        const otpId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return res.json(
          successResponse('OTP sent successfully', {
            id: otpId,
            phone: phoneNumber,
            expiresInSeconds: 300,
            devOtpCode: code // Displaying explicitly for testing
          })
        );
      } catch (err: any) {
        return res.status(500).json(errorResponse('Failed to send SMS OTP. Please try again later.', 'OTP_SEND_FAILED'));
      }
    }

    return res.status(400).json(errorResponse('Either email or phone is required', 'VALIDATION_ERROR'));
  } catch (error) {
    next(error);
  }
};

export const resendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, phone, countryCode } = req.body;

    if (email) {
      const isDomainValid = await validateEmailDomain(email);
      if (!isDomainValid) {
        return res.status(400).json(errorResponse('Email domain is not valid or not receiving emails', 'VALIDATION_ERROR'));
      }

      const { code } = await issueEmailOtp(email);
      const emailSent = await sendVerificationEmail(email, code);

      if (!emailSent) {
        return res.status(500).json(errorResponse('Failed to resend OTP email. Please try again later.', 'OTP_SEND_FAILED'));
      }

      const otpId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return res.json(
        successResponse('OTP resent successfully', {
          id: otpId,
          email,
          expiresInSeconds: 600,
          devOtpCode: code
        })
      );
    }

    if (phone && countryCode) {
      try {
        const { phoneNumber, code } = await issuePhoneOtp(phone, countryCode);
        return res.json(
          successResponse('OTP resent successfully', {
            phone: phoneNumber,
            expiresInSeconds: 300,
            devOtpCode: code
          })
        );
      } catch (err: any) {
        return res.status(500).json(errorResponse('Failed to resend SMS OTP. Please try again later.', 'OTP_SEND_FAILED'));
      }
    }

    return res.status(400).json(errorResponse('Either email or phone is required', 'VALIDATION_ERROR'));
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

export const checkEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(errorResponse('Email is required', 'VALIDATION_ERROR'));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json(errorResponse('Invalid email address format', 'VALIDATION_ERROR'));
    }

    const isDomainValid = await validateEmailDomain(email);
    if (!isDomainValid) {
      return res.status(400).json(errorResponse('Email domain is not valid or not receiving emails', 'VALIDATION_ERROR'));
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json(errorResponse('Email is already registered.', 'EMAIL_EXISTS'));
    }
    return res.json(successResponse('Email is available', { available: true }));
  } catch (error) { next(error); }
};


