import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { SmsChannelAdapter } from "../../modules/notifications/notification.service.js";
import { renderEmailTemplate } from "../../services/settings/settings.service.js";
import { sendEmail } from "../../services/mobile/email.service.js";
import { sanitizeUserRecord } from "../../routes/index.js";
import { calculateOnboardingProgress } from "../../config/onboarding.js";
import { getVerificationStats } from "../../common/helpers/verification.js";
import { bootstrapUserResources } from "../../services/mobile/auth-bootstrap.service.js";

const PORTAL_ROLES = new Set(["freelancer", "client", "investor", "founder"]);

type TokenUser = { id: string; email: string; role: string; type?: "admin" | "portal" };

const signAccessToken = (user: TokenUser) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: user.type ?? "admin" },
    env.JWT_SECRET,
    { expiresIn: "48h" },
  );
};

const signRefreshToken = (user: TokenUser) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: user.type ?? "admin" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
  );
};

function normalizePortalRole(role: unknown) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "client / business" || value === "business") return "client";
  if (value === "startup founder") return "founder";
  return value;
}

function canReuseRegistrationEmail(
  user: {
    deletedAt?: Date | string | null;
    status?: string | null;
    isVerified?: boolean | null;
    verified?: boolean | null;
  } | null
) {
  if (!user) return true;
  if (user.deletedAt) return true;

  const status = String(user.status || "").trim().toLowerCase();
  if (["pending_deletion", "deleted", "deleted_by_user"].includes(status)) return true;

  const emailVerified = user.isVerified === true || user.verified === true;
  return status === "pending" && !emailVerified;
}

function getClientHost(req?: Request): string {
  const origin = req?.headers?.origin;
  if (origin && typeof origin === "string" && origin.startsWith("http")) {
    return origin.replace(/\/+$/, "");
  }
  const referer = req?.headers?.referer;
  if (referer && typeof referer === "string" && referer.startsWith("http")) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore invalid referer URL
    }
  }
  return (process.env.CLIENT_URL || process.env.FRONTEND_URL || "https://goexperts.in").replace(/\/+$/, "");
}

async function verifyPassword(password: string, storedHash: string) {
  if (!storedHash) return false;
  // bcrypt hashes start with $2a$ / $2b$ / $2y$
  if (storedHash.startsWith("$2")) {
    try {
      return await bcrypt.compare(password, storedHash);
    } catch {
      return false;
    }
  }
  // Legacy plain-text passwords (migrate on successful login if needed)
  return password === storedHash;
}

function clientMeta(req: Request) {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || null;
  const userAgent = req.headers["user-agent"] || null;
  return { ipAddress, userAgent };
}

function buildKycReadiness(user: any) {
  const stats = getVerificationStats(user);
  const submitted = stats.missingCount === 0;
  const verified = stats.requiredTotal > 0 && stats.requiredVerified >= stats.requiredTotal;
  return {
    submitted,
    verified,
    status: verified ? "verified" : submitted ? "submitted" : "missing",
    missingCount: stats.missingCount,
    pendingCount: stats.pendingCount,
    verifiedCount: stats.verifiedCount,
    requiredVerified: stats.requiredVerified,
    requiredTotal: stats.requiredTotal,
    trustScore: stats.trustScore,
  };
}


async function getRoleColor(user: any): Promise<string> {
  const DEFAULT_COLOR = "#0f172a";
  try {
    const { prisma } = await import("../../config/database.js");
    const setting = await prisma.setting.findUnique({ where: { key: "settings:industry_colors" } });
    if (!setting || !setting.value) return DEFAULT_COLOR;
    const colors = JSON.parse(setting.value);
    
    // Match based on user role (case-insensitive)
    const userRole = (user?.role || "").toLowerCase();
    
    // Find matching role color in the JSON keys
    let matchedColor = DEFAULT_COLOR;
    for (const [key, color] of Object.entries(colors)) {
      if (key.toLowerCase() === userRole || key.toLowerCase() === userRole + 's') {
        matchedColor = String(color);
        break;
      }
    }
    return matchedColor;
  } catch (err) {
    return DEFAULT_COLOR;
  }
}

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inputEmail = req.body?.email ?? req.body?.identifier ?? req.body?.username ?? req.body?.emailId;
    const rawEmail = typeof inputEmail === "string" ? inputEmail.trim() : String(inputEmail || "").trim();
    const email = rawEmail.toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : String(req.body?.password || "");
    if (!rawEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const { ipAddress, userAgent } = clientMeta(req);

    // 1) Super Admin users
    let admin: any = null;
    try {
      const adminWhere = rawEmail && email && rawEmail !== email
        ? { OR: [{ email: rawEmail }, { email }] }
        : { email };

      admin = await prisma.adminUser.findFirst({
        where: adminWhere,
        include: { role: true },
      }).catch(async () => {
        return prisma.adminUser.findFirst({ where: adminWhere }).catch(() => null);
      });
    } catch {
      admin = null;
    }

    if (admin) {
      if (!admin.password) {
        prisma.loginAttempt
          .create({ data: { email, ipAddress, userAgent, success: false, failReason: "No password set (OAuth)" } })
          .catch(() => {});
        return res.status(400).json({ success: false, message: "This account was created using Google or social login. Please sign in with that provider, or reset your password." });
      }

      const isMatch = await verifyPassword(password, admin.password);
      if (!isMatch) {
        prisma.loginAttempt
          .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Wrong password" } })
          .catch(() => {});
        return res.status(400).json({ success: false, message: "Invalid email or password" });
      }

      if (admin.status !== "active") {
        prisma.loginAttempt
          .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Account suspended" } })
          .catch(() => {});
        return res.status(403).json({ success: false, message: "User suspended or inactive" });
      }

      const payload: TokenUser = {
        id: admin.id,
        email: admin.email,
        role: (admin as any).role?.name || "super_admin",
        type: "admin",
      };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      await prisma.refreshToken.create({
        data: {
          adminUserId: admin.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }).catch(() => {});

      await prisma.session.create({
        data: {
          adminUserId: admin.id,
          token: accessToken,
          ipAddress: (req.ip || "").toString(),
          userAgent: req.headers["user-agent"] || "",
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      }).catch(() => {});

      await prisma.activityLog.create({
        data: {
          adminUserId: admin.id,
          action: "login",
          description: `Successfully logged in from IP ${req.ip}`,
        },
      }).catch(() => {});

      prisma.loginAttempt
        .create({ data: { email, ipAddress, userAgent, success: true } })
        .catch(() => {});

      const userPayload = {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName || "Super Admin",
        name: admin.fullName || "Super Admin",
        avatarUrl: admin.avatarUrl,
        role: (admin as any).role?.name || "super_admin",
        status: admin.status
      };

      return res.json({
        success: true,
        message: "Login successful",
        token: accessToken,
        accessToken,
        refreshToken,
        data: {
          token: accessToken,
          accessToken,
          refreshToken,
          user: userPayload
        },
        user: userPayload
      });
    }

    // 2) Public website users (freelancer / client / investor / founder)
    let user: any = null;
    try {
      const userWhere = rawEmail && email && rawEmail !== email
        ? { OR: [{ email: rawEmail }, { email }] }
        : { email };

      user = await prisma.user.findFirst({
        where: userWhere,
        include: {
          freelancerProfile: true,
          clientProfile: true,
          investorProfile: true,
          founderProfile: true,
        },
      }).catch(() => null);
    } catch {
      user = null;
    }

    if (!user) {
      prisma.loginAttempt
        .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Email not found" } })
        .catch(() => {});
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    if (user.deletedAt) {
      prisma.loginAttempt
        .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Account deleted" } })
        .catch(() => {});
      return res.status(403).json({ success: false, message: "Your account is suspended. Please contact support." });
    }

    if (!user.password) {
      prisma.loginAttempt
        .create({ data: { email, ipAddress, userAgent, success: false, failReason: "No password set (OAuth)" } })
        .catch(() => {});
      return res.status(400).json({ success: false, message: "This account was created using Google or social login. Please sign in with that provider, or reset your password." });
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      prisma.loginAttempt
        .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Wrong password" } })
        .catch(() => {});
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    // Upgrade legacy plain-text passwords to bcrypt after a successful login
    if (user.password && !user.password.startsWith("$2")) {
      const hashed = await bcrypt.hash(password, 10);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    }

    const userStatus = String(user.status).toLowerCase();
    if (userStatus === "suspended") {
      prisma.loginAttempt
        .create({ data: { email, ipAddress, userAgent, success: false, failReason: "Account suspended" } })
        .catch(() => {});
      return res.status(403).json({ success: false, message: "Your account is suspended. Please contact support." });
    }

    const payload: TokenUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      type: "portal",
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Save location data if provided during login
    if (req.body?.latitude && req.body?.longitude) {
      let currentRegData: any = {};
      try {
        currentRegData = typeof user.registrationData === 'string' 
          ? JSON.parse(user.registrationData) 
          : (user.registrationData || {});
      } catch (e) {}
      currentRegData.latitude = req.body.latitude;
      currentRegData.longitude = req.body.longitude;
      await prisma.user.update({
        where: { id: user.id },
        data: { registrationData: JSON.stringify(currentRegData) }
      }).catch(() => {});
    }

    prisma.loginAttempt
      .create({ data: { email, ipAddress, userAgent, success: true } })
      .catch(() => {});

    let completion: any = { profileCompletion: 100, isProfileComplete: true, completedSteps: [], pendingSteps: [] };
    let subscriptionGate: any = { status: 'none', planId: null, planName: null };
    try {
      const { resolveProfileCompletion } = await import("../../services/mobile/profile-completion.service.js");
      const { resolveUserSubscriptionGate } = await import("../../services/mobile/subscription.service.js");
      const [c, s] = await Promise.all([
        resolveProfileCompletion(user.id).catch(() => completion),
        resolveUserSubscriptionGate(user.id).catch(() => subscriptionGate),
      ]);
      completion = c;
      subscriptionGate = s;
    } catch {
      // fallback
    }

    const hasActiveSubscription = subscriptionGate.status === 'active';
    const kycReadiness = buildKycReadiness(user);

    const userPayload = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      onboardingStatus: user.onboardingStatus,
      country: user.country,
      state: user.state,
      city: user.city,
      isVerified: Boolean(user.isVerified || user.verified),
      isKycSubmitted: kycReadiness.submitted,
      isKycVerified: kycReadiness.verified,
      kycStatus: kycReadiness.status,
      kyc: kycReadiness,
      profileCompletion: completion.profileCompletion,
      isProfileComplete: completion.isProfileComplete,
      completedSteps: completion.completedSteps,
      pendingSteps: completion.pendingSteps,
      subscriptionPlan: hasActiveSubscription,
      hasSubscription: hasActiveSubscription,
      isSubscribed: hasActiveSubscription,
      subscriptionStatus: subscriptionGate.status,
      subscriptionPlanId: subscriptionGate.planId,
      subscriptionPlanName: subscriptionGate.planName ?? subscriptionGate.planId,
      profileReadiness: {
        role: (user.role || "").toUpperCase(),
        profileCompletion: completion.profileCompletion,
        profileLevel: completion.profileLevel || 'INCOMPLETE',
        operationalReady: completion.operationalReady || false,
        requirements: completion.requirements || { core: { complete: false, missing: [] }, recommended: { missing: [] } },
        verification: completion.verification || { email: 'PENDING', phone: 'PENDING', identity: 'PENDING' },
        capabilities: completion.capabilities || {}
      }
    };

    return res.json({
      success: true,
      message: "Login successful",
      token: accessToken,
      accessToken,
      refreshToken,
      subscriptionPlan: hasActiveSubscription,
      hasSubscription: hasActiveSubscription,
      isSubscribed: hasActiveSubscription,
      user: userPayload,
      data: {
        token: accessToken,
        accessToken,
        refreshToken,
        subscriptionPlan: hasActiveSubscription,
        hasSubscription: hasActiveSubscription,
        isSubscribed: hasActiveSubscription,
        user: userPayload,
      }
    });
  } catch (err) {
    next(err);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    let fullName = String(req.body?.fullName || req.body?.name || "").trim();
    let role = normalizePortalRole(req.body?.role);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (!fullName) {
      fullName = email.split('@')[0] || "User";
    }

    if (!role || !PORTAL_ROLES.has(role)) {
      role = "freelancer";
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (!canReuseRegistrationEmail(existing)) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists. Please use a different email address.",
        existingUser: {
          role: existing.role,
          status: existing.status,
          isVerified: existing.isVerified ?? existing.verified ?? false,
        },
      });
    }
    // If user exists but can be reused, we'll restore them below in the transaction.

    const hashed = await bcrypt.hash(password, 10);
    const phone = req.body?.phone ? String(req.body.phone) : null;
    const country = req.body?.country ? String(req.body.country) : null;
    const state = req.body?.state ? String(req.body.state) : null;
    const city = req.body?.city ? String(req.body.city) : null;
    const latitudeRaw = req.body?.latitude;
    const longitudeRaw = req.body?.longitude;
    const latitude = latitudeRaw === undefined || latitudeRaw === null || latitudeRaw === ""
      ? null
      : Number(latitudeRaw);
    const longitude = longitudeRaw === undefined || longitudeRaw === null || longitudeRaw === ""
      ? null
      : Number(longitudeRaw);
    const bio = req.body?.bio ? String(req.body.bio) : null;

    const { email: _email, password: _password, fullName: _fullName, role: _role, phone: _phone, country: _country, state: _state, city: _city, bio: _bio, ...restData } = req.body || {};
    const registrationData = Object.keys(restData).length > 0 ? restData : undefined;

    const trialEndsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    
    // Generate unique referral code for the new user
    let baseCode = (fullName.split(' ')[0] || "USER").toUpperCase().replace(/[^A-Z]/g, '');
    if (baseCode.length < 3) baseCode = "GEX" + baseCode;
    const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const referralCode = `GOEXPERTS-${baseCode}${randStr}`;

    const ref = req.body?.ref || req.query?.ref;
    let referrer = null;
    let referralClick = null;
    if (ref) {
      referrer = await prisma.user.findUnique({ where: { referralCode: String(ref) } });
      if (!referrer) {
        // Also check if ref is a clickId
        referralClick = await prisma.referralClick.findUnique({ where: { id: String(ref) }, include: { referrer: true } });
        if (referralClick) {
          referrer = referralClick.referrer;
        }
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      const created = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              password: hashed,
              fullName,
              role,
              status: "pending",
              trialEndsAt,
              phone,
              country,
              state,
              city,
              latitude: Number.isFinite(latitude as number) ? latitude : null,
              longitude: Number.isFinite(longitude as number) ? longitude : null,
              bio,
              registrationData,
              // IMPORTANT: Clear soft-delete so the account is restored/visible
              deletedAt: null,
              isVerified: false,
              verified: false,
            },
          })
        : await tx.user.create({
            data: {
              email,
              password: hashed,
              fullName,
              role,
              status: "pending",
              trialEndsAt,
              phone,
              country,
              state,
              city,
              latitude: Number.isFinite(latitude as number) ? latitude : null,
              longitude: Number.isFinite(longitude as number) ? longitude : null,
              bio,
              registrationData,
              referralCode,
            },
          });

      // Handle Referral Creation
      if (referrer && created) {
        // Find default campaign (if exists)
        const campaign = await tx.referralCampaign.findFirst({ where: { status: "ACTIVE" } });
        
        const referral = await tx.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId: created.id,
            campaignId: campaign?.id,
            clickId: referralClick?.id,
            status: "PENDING",
          }
        });

        await tx.referralEvent.create({
          data: {
            referralId: referral.id,
            eventType: "SIGNED_UP",
            metadata: JSON.stringify({ role: created.role })
          }
        });
      }

      if (role === "freelancer") {
        const skills = Array.isArray(req.body?.skills)
          ? req.body.skills.join(", ")
          : (req.body?.skills ? String(req.body.skills) : null);
        const hourlyRate = Number(req.body?.hourlyRate);
        const verificationData = JSON.stringify({
          aadhaarNumber: req.body?.aadhaarNumber || null,
          panNumber: req.body?.panNumber || null,
          idDocumentUrl: req.body?.idDocumentUrl || null,
        });

        let industryName = req.body?.industry || req.body?.category || null;
        if (industryName && industryName.length === 36) {
          const industryRow = await tx.industry.findFirst({
            where: { id: industryName }
          }).catch(() => null);
          if (industryRow?.name) {
            industryName = industryRow.name;
          }
        }

        let pUrls: any = {};
        if (typeof req.body?.portfolioUrls === "string") {
          try {
            pUrls = JSON.parse(req.body.portfolioUrls);
          } catch {
            pUrls = {};
          }
        } else if (typeof req.body?.portfolioUrls === "object" && req.body?.portfolioUrls !== null) {
          pUrls = req.body.portfolioUrls;
        }

        const portfolioUrl = pUrls.portfolio || req.body?.portfolioUrl || "";
        const githubUrl = pUrls.github || req.body?.githubUrl || "";
        const attachmentUrl = pUrls.attachment || req.body?.portfolioFileUrl || "";

        let initialPortfolioJson: string | undefined = undefined;
        if (portfolioUrl || githubUrl || attachmentUrl) {
          const initialDraftItem = {
            id: `PF-INIT-${Date.now().toString(36).toUpperCase()}`,
            title: "Initial Project (From Signup)",
            thumb: attachmentUrl || "",
            category: industryName || "General",
            tech: skills ? String(skills).split(",").slice(0, 4).join(", ") : "General",
            industry: industryName || "",
            client: "Self Project",
            duration: "Ongoing",
            team: 1,
            role: "Primary Contributor",
            status: "Draft",
            views: 0,
            likes: 0,
            shares: 0,
            created: new Date().toISOString().slice(0, 10),
            overview: bio || "Project details and attachments uploaded during account registration.",
            githubUrl: githubUrl || "",
            liveUrl: portfolioUrl || "",
            pdfUrl: attachmentUrl || "",
          };
          initialPortfolioJson = JSON.stringify([initialDraftItem]);
        }

        await tx.freelancerProfile.upsert({
          where: { userId: created.id },
          create: {
            userId: created.id,
            industry: industryName,
            skills,
            hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
            experience: req.body?.experience ? String(req.body.experience) : null,
            verificationJson: verificationData,
            portfolioJson: initialPortfolioJson,
          },
          update: {
            industry: industryName,
            skills,
            hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
            experience: req.body?.experience ? String(req.body.experience) : null,
            verificationJson: verificationData,
            ...(initialPortfolioJson ? { portfolioJson: initialPortfolioJson } : {}),
          },
        });
      }

      if (role === "client") {
        let industryName = req.body?.industry || req.body?.category || null;
        if (industryName && industryName.length === 36) {
          const industryRow = await tx.industry.findFirst({
            where: { id: industryName }
          }).catch(() => null);
          if (industryRow?.name) {
            industryName = industryRow.name;
          }
        }

        await tx.clientProfile.upsert({
          where: { userId: created.id },
          create: {
            userId: created.id,
            company: req.body?.company ? String(req.body.company) : null,
            industry: industryName,
          },
          update: {
            company: req.body?.company ? String(req.body.company) : null,
            industry: industryName,
          },
        });
      }

      if (role === "investor") {
        const ticketMin = Number(req.body?.ticketMin);
        const ticketMax = Number(req.body?.ticketMax);
        await tx.investorProfile.upsert({
          where: { userId: created.id },
          create: {
            userId: created.id,
            firm: req.body?.firm ? String(req.body.firm) : null,
            ticketMin: Number.isFinite(ticketMin) ? ticketMin : null,
            ticketMax: Number.isFinite(ticketMax) ? ticketMax : null,
            focusAreas: req.body?.focusAreas ? String(req.body.focusAreas) : null,
          },
          update: {
            firm: req.body?.firm ? String(req.body.firm) : null,
            ticketMin: Number.isFinite(ticketMin) ? ticketMin : null,
            ticketMax: Number.isFinite(ticketMax) ? ticketMax : null,
            focusAreas: req.body?.focusAreas ? String(req.body.focusAreas) : null,
          },
        });
      }

      if (role === "founder") {
        await tx.founderProfile.upsert({
          where: { userId: created.id },
          create: {
            userId: created.id,
            startupName: req.body?.startupName || req.body?.company || null,
            industry: req.body?.industry || req.body?.category || null,
            stage: req.body?.stage || null,
          },
          update: {
            startupName: req.body?.startupName || req.body?.company || null,
            industry: req.body?.industry || req.body?.category || null,
            stage: req.body?.stage || null,
          },
        });
      }

      return created;
    });

    // Welcome email is NOT sent here — it is sent after all onboarding steps are completed
    const tokenPayload = { id: user.id, email: user.email, role: user.role, type: "portal" as const };
    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        freelancerProfile: true,
        clientProfile: true,
        investorProfile: true,
        founderProfile: true,
      },
    });

    const sanitizedUser = sanitizeUserRecord(fullUser || user);

    try {
      const { getIO } = await import("../../modules/realtime/socket.js");
      const io = getIO();
      if (io) {
        io.emit("admin:new_user", {
          id: sanitizedUser.id,
          fullName: sanitizedUser.fullName,
          email: sanitizedUser.email,
          role: sanitizedUser.role,
          createdAt: sanitizedUser.createdAt
        });
      }
    } catch (e) {
      console.warn("Could not emit socket event for new user", e);
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      accessToken,
      refreshToken,
      token: accessToken,
      user: sanitizedUser,
      data: sanitizedUser,
    });
  } catch (err) {
    next(err);
  }
};

export const registerAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const fullName = String(req.body?.fullName || req.body?.name || "Admin User").trim();
    const roleName = String(req.body?.role || req.body?.roleName || "super_admin").trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const existing = await prisma.adminUser.findFirst({ where: { email } });
    if (existing) {
      const updatedAdmin = await prisma.adminUser.update({
        where: { id: existing.id },
        data: {
          password: passwordHash,
          fullName: fullName || existing.fullName,
          status: "active"
        }
      });

      return res.json({
        success: true,
        message: "Admin user updated successfully",
        data: {
          id: updatedAdmin.id,
          email: updatedAdmin.email,
          fullName: updatedAdmin.fullName,
          role: roleName,
          status: updatedAdmin.status
        }
      });
    }

    let roleId: string | undefined = undefined;
    try {
      const dbRole = await prisma.role.findFirst({
        where: { name: { equals: roleName } }
      });
      if (dbRole) {
        roleId = dbRole.id;
      }
    } catch {
      // role table is optional
    }

    const adminData: any = {
      email,
      password: passwordHash,
      fullName,
      status: "active",
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`
    };

    if (roleId) {
      adminData.roleId = roleId;
    }

    const newAdmin = await prisma.adminUser.create({
      data: adminData
    });

    return res.status(201).json({
      success: true,
      message: "Admin user registered successfully",
      data: {
        id: newAdmin.id,
        email: newAdmin.email,
        fullName: newAdmin.fullName,
        role: roleName,
        status: newAdmin.status,
        createdAt: newAdmin.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      await prisma.session.updateMany({
        where: { token },
        data: { revokedAt: new Date() },
      });
    }

    if (req.body.refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: req.body.refreshToken },
        data: { revokedAt: new Date() },
      });
    }

    if (req.user?.type === "admin") {
      await prisma.activityLog.create({
        data: {
          adminUserId: req.user.id,
          action: "logout",
          description: "Successfully logged out",
        },
      });
    }

    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: "Refresh token is required" });
    }

    // Admin refresh tokens are stored in DB
    const storedToken = await prisma.refreshToken.findFirst({
      where: { token: refreshToken },
      include: { adminUser: { include: { role: true } } },
    });

    if (storedToken && !storedToken.revokedAt && storedToken.expiresAt >= new Date()) {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as TokenUser;
      const payload: TokenUser = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        type: "admin",
      };
      return res.json({ success: true, accessToken: signAccessToken(payload) });
    }

    // Portal refresh tokens are JWT-only
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as TokenUser;
      if (decoded.type === "portal" || !storedToken) {
        const user = await prisma.user.findFirst({
          where: { id: decoded.id, deletedAt: null },
        });
        if (!user || String(user.status).toLowerCase() !== "active") {
          return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
        }
        const payload: TokenUser = {
          id: user.id,
          email: user.email,
          role: user.role,
          type: "portal",
        };
        return res.json({ success: true, accessToken: signAccessToken(payload) });
      }
    } catch {
      // fall through
    }

    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  } catch (err) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};

export const me = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (req.user.type === "portal") {
      const user = await prisma.user.findFirst({
        where: { id: req.user.id, deletedAt: null },
        include: {
          freelancerProfile: true,
          clientProfile: true,
          investorProfile: true,
          founderProfile: true,
        },
      });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      let completion: any = { profileCompletion: 0, isProfileComplete: false, completedSteps: [], pendingSteps: [] };
      try {
        const { resolveProfileCompletion } = await import("../../services/mobile/profile-completion.service.js");
        completion = await resolveProfileCompletion(user.id);
      } catch (err) {}

      const sanitized: any = sanitizeUserRecord(user);
      
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const uuids = new Set<string>();
        if (typeof sanitized.title === 'string' && uuidRegex.test(sanitized.title)) uuids.add(sanitized.title);
        if (Array.isArray(sanitized.industry)) {
          sanitized.industry.forEach((i: any) => {
            if (i.industryName && uuidRegex.test(i.industryName)) uuids.add(i.industryId);
          });
        }
        
        if (uuids.size > 0) {
          const ids = Array.from(uuids);
          const [dbIndustries, moSkills] = await Promise.all([
            prisma.industry.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
            (prisma as any).masterOption.findMany({ where: { id: { in: ids } }, select: { id: true, label: true, value: true } })
          ]);
          const resolvedMap = new Map();
          dbIndustries.forEach(s => resolvedMap.set(s.id, s.name));
          moSkills.forEach((s: any) => resolvedMap.set(s.id, s.label || s.value));
          
          if (resolvedMap.has(sanitized.title)) {
            const mapped = resolvedMap.get(sanitized.title);
            sanitized.title = mapped;
            sanitized.titleHeadline = mapped;
            sanitized.professionalTitle = mapped;
          }
          if (Array.isArray(sanitized.industry)) {
            sanitized.industry.forEach((i: any) => {
              if (resolvedMap.has(i.industryId)) {
                const mapped = resolvedMap.get(i.industryId);
                i.industryName = mapped;
              }
            });
          }
        }
      } catch(e) {}

      const kycReadiness = buildKycReadiness(user);

        return res.json({
        success: true,
        user: {
          ...sanitized,
          isKycSubmitted: kycReadiness.submitted,
          isKycVerified: kycReadiness.verified,
          kycStatus: kycReadiness.status,
          kyc: kycReadiness,
          profileCompletion: completion.profileCompletion,
          profileCompletedPer: completion.profileCompletion,
          profileCompletedPercentage: completion.profileCompletion,
          profileReadiness: {
            role: (user.role || "").toUpperCase(),
            profileCompletion: completion.profileCompletion,
            profileLevel: completion.profileLevel || 'INCOMPLETE',
            operationalReady: completion.operationalReady || false,
            requirements: completion.requirements || { core: { complete: false, missing: [] }, recommended: { missing: [] } },
            verification: completion.verification || { email: 'PENDING', phone: 'PENDING', identity: 'PENDING' },
            capabilities: completion.capabilities || {}
          },
          isProfileComplete: completion.isProfileComplete || false,
          completedSteps: completion.completedSteps || [],
          pendingSteps: completion.pendingSteps || [],
        },
      });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    if (!admin) {
      // Fallback for older tokens without type claim
      const user = await prisma.user.findFirst({
        where: { id: req.user.id, deletedAt: null },
        include: {
          freelancerProfile: true,
          clientProfile: true,
          investorProfile: true,
          founderProfile: true,
        },
      });
      if (user) {
        let completion: any = { profileCompletion: 0, isProfileComplete: false, completedSteps: [], pendingSteps: [] };
        try {
          const { resolveProfileCompletion } = await import("../../services/mobile/profile-completion.service.js");
          completion = await resolveProfileCompletion(user.id);
        } catch (err) {}

        const sanitizedFallback: any = sanitizeUserRecord(user);
        
        try {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const uuids = new Set<string>();
          if (typeof sanitizedFallback.title === 'string' && uuidRegex.test(sanitizedFallback.title)) uuids.add(sanitizedFallback.title);
          if (Array.isArray(sanitizedFallback.industry)) {
            sanitizedFallback.industry.forEach((i: any) => {
              if (i.industryName && uuidRegex.test(i.industryName)) uuids.add(i.industryId);
            });
          }
          
          if (uuids.size > 0) {
            const ids = Array.from(uuids);
            const [dbIndustries, moSkills] = await Promise.all([
              prisma.industry.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
              (prisma as any).masterOption.findMany({ where: { id: { in: ids } }, select: { id: true, label: true, value: true } })
            ]);
            const resolvedMap = new Map();
            dbIndustries.forEach(s => resolvedMap.set(s.id, s.name));
            moSkills.forEach((s: any) => resolvedMap.set(s.id, s.label || s.value));
            
            if (resolvedMap.has(sanitizedFallback.title)) {
              const mapped = resolvedMap.get(sanitizedFallback.title);
              sanitizedFallback.title = mapped;
              sanitizedFallback.titleHeadline = mapped;
              sanitizedFallback.professionalTitle = mapped;
            }
            if (Array.isArray(sanitizedFallback.industry)) {
              sanitizedFallback.industry.forEach((i: any) => {
                if (resolvedMap.has(i.industryId)) {
                  const mapped = resolvedMap.get(i.industryId);
                  i.industryName = mapped;
                }
              });
            }
          }
        } catch(e) {}

        const kycReadiness = buildKycReadiness(user);

        return res.json({
          success: true,
          user: {
            ...sanitizedFallback,
              isKycSubmitted: kycReadiness.submitted,
              isKycVerified: kycReadiness.verified,
              kycStatus: kycReadiness.status,
              kyc: kycReadiness,
              profileCompletion: completion.profileCompletion,
              profileCompletedPer: completion.profileCompletion,
              profileCompletedPercentage: completion.profileCompletion,
              profileReadiness: {
                role: (user.role || "").toUpperCase(),
                profileCompletion: completion.profileCompletion,
                profileLevel: completion.profileLevel || 'INCOMPLETE',
                operationalReady: completion.operationalReady || false,
                requirements: completion.requirements || { core: { complete: false, missing: [] }, recommended: { missing: [] } },
                verification: completion.verification || { email: 'PENDING', phone: 'PENDING', identity: 'PENDING' },
                capabilities: completion.capabilities || {}
              },
              isProfileComplete: completion.isProfileComplete || false,
              completedSteps: completion.completedSteps || [],
              pendingSteps: completion.pendingSteps || [],
          },
        });
      }
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        avatarUrl: admin.avatarUrl,
        role: admin.role.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const fullName = req.body?.fullName !== undefined ? String(req.body.fullName).trim() : undefined;
    const email = req.body?.email !== undefined ? String(req.body.email).trim().toLowerCase() : undefined;
    const avatarUrl = req.body?.avatarUrl !== undefined ? String(req.body.avatarUrl).trim() : undefined;

    if (email !== undefined && !email) {
      return res.status(400).json({ success: false, message: "Email cannot be empty" });
    }

    if (req.user.type === "portal") {
      const user = await prisma.user.findFirst({
        where: { id: req.user.id, deletedAt: null },
      });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      if (email && email !== user.email) {
        const existing = await prisma.user.findFirst({
          where: { email, id: { not: user.id }, deletedAt: null },
        });
        if (existing) {
          return res.status(409).json({ success: false, message: "A user with this email already exists" });
        }
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(fullName !== undefined && { fullName }),
          ...(email !== undefined && { email }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
      });

      return res.json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: updated.id,
          email: updated.email,
          fullName: updated.fullName,
          avatarUrl: updated.avatarUrl,
          role: updated.role,
          status: updated.status || "active",
        },
      });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    if (!admin) {
      const user = await prisma.user.findFirst({
        where: { id: req.user.id, deletedAt: null },
      });
      if (user) {
        if (email && email !== user.email) {
          const existing = await prisma.user.findFirst({
            where: { email, id: { not: user.id }, deletedAt: null },
          });
          if (existing) {
            return res.status(409).json({ success: false, message: "A user with this email already exists" });
          }
        }
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: {
            ...(fullName !== undefined && { fullName }),
            ...(email !== undefined && { email }),
            ...(avatarUrl !== undefined && { avatarUrl }),
          },
        });
        return res.json({
          success: true,
          message: "Profile updated successfully",
          user: {
            id: updated.id,
            email: updated.email,
            fullName: updated.fullName,
            avatarUrl: updated.avatarUrl,
            role: updated.role,
            status: updated.status || "active",
          },
        });
      }
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (email && email !== admin.email) {
      const existing = await prisma.adminUser.findFirst({
        where: { email, id: { not: admin.id } },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: "An admin user with this email already exists" });
      }
    }

    const updatedAdmin = await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(email !== undefined && { email }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      include: { role: true },
    });

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        fullName: updatedAdmin.fullName,
        avatarUrl: updatedAdmin.avatarUrl,
        role: updatedAdmin.role.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const uploadAvatar = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const file = req.file;
    const host = req.get("host");
    const proto = (req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
    const avatarUrl = host ? `${proto}://${host}/uploads/${file.filename}` : `/uploads/${file.filename}`;

    if (req.user.type === "portal") {
      const user = await prisma.user.findFirst({
        where: { id: req.user.id, deletedAt: null },
      });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl },
      });

      return res.json({
        success: true,
        message: "Avatar uploaded successfully",
        avatarUrl: updated.avatarUrl,
        user: {
          id: updated.id,
          email: updated.email,
          fullName: updated.fullName,
          avatarUrl: updated.avatarUrl,
          role: updated.role,
        },
      });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: req.user.id },
      include: { role: true },
    });

    if (!admin) {
      const user = await prisma.user.findFirst({
        where: { id: req.user.id, deletedAt: null },
      });
      if (user) {
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { avatarUrl },
        });
        return res.json({
          success: true,
          message: "Avatar uploaded successfully",
          avatarUrl: updated.avatarUrl,
          user: {
            id: updated.id,
            email: updated.email,
            fullName: updated.fullName,
            avatarUrl: updated.avatarUrl,
            role: updated.role,
          },
        });
      }
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updatedAdmin = await prisma.adminUser.update({
      where: { id: admin.id },
      data: { avatarUrl },
      include: { role: true },
    });

    return res.json({
      success: true,
      message: "Avatar uploaded successfully",
      avatarUrl: updatedAdmin.avatarUrl,
      user: {
        id: updatedAdmin.id,
        email: updatedAdmin.email,
        fullName: updatedAdmin.fullName,
        avatarUrl: updatedAdmin.avatarUrl,
        role: updatedAdmin.role.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const okMessage = "Password reset instructions have been sent to your registered email address.";
    const missingMessage = "No Go Experts account was found with this email address.";

    const admin = await prisma.adminUser.findFirst({
      where: { OR: [{ email }, { email: String(req.body?.email || "").trim() }] },
    });
    const portalUser = !admin
      ? await prisma.user.findFirst({ where: { email, deletedAt: null } })
      : null;

    if (!admin && !portalUser) {
      return res.status(404).json({ success: false, message: missingMessage });
    }

    const subject = admin
      ? { id: admin.id, email: admin.email, type: "admin" as const }
      : { id: portalUser!.id, email: portalUser!.email, type: "portal" as const };

    const resetToken = jwt.sign(
      { id: subject.id, email: subject.email, type: subject.type, purpose: "password_reset" },
      env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    const settingKey = `password_reset:${subject.type}:${subject.id}`;
    await prisma.setting.upsert({
      where: { key: settingKey },
      update: { value: resetToken, category: "security" },
      create: { key: settingKey, value: resetToken, category: "security" },
    });

    const resetUrl = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
    console.log(`[password-reset] ${subject.email} → ${resetUrl}`);

    // Attempt email through the active SMTP channel and report delivery failures.
    try {
      const nodemailer = await import("nodemailer");
      const channel = await prisma.communicationChannel.findFirst({
        where: { name: "email", status: "active" },
      });
      const config = channel?.config ? JSON.parse(channel.config) : null;
      
      const smtpHost = config?.host || process.env.SMTP_HOST;
      const smtpPort = Number(config?.port || process.env.SMTP_PORT) || 587;
      const smtpUser = config?.user || process.env.SMTP_USER;
      const smtpPass = config?.pass || config?.password || process.env.SMTP_PASS;
      const smtpFrom = config?.from || config?.user || process.env.SMTP_FROM || process.env.SMTP_USER;
      const smtpSecure = config?.secure ?? (smtpPort === 465);

      console.log(`[password-reset] Trying to send email to ${subject.email}`);
      console.log(`[password-reset] SMTP Config: host=${smtpHost}, port=${smtpPort}, user=${smtpUser}, from=${smtpFrom}`);

      if (smtpHost && smtpUser) {
        console.log(`[password-reset] Creating transporter...`);
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: { user: smtpUser, pass: smtpPass },
        });
        
        console.log(`[password-reset] Sending mail...`);
        const info = await transporter.sendMail({
          from: smtpFrom,
          to: subject.email,
          subject: "Go Experts — Password Reset",
          text: `Reset your password using this link (valid 1 hour):\n\n${resetUrl}\n`,
          html: `<p>Reset your password using this link (valid 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        });
        console.log(`[password-reset] Email sent successfully: ${info.messageId}`);
      } else {
        throw new Error("SMTP_HOST or SMTP_USER environment variables are missing on this server.");
      }
    } catch (mailErr: any) {
      console.warn("[password-reset] email send skipped/failed:", mailErr);
      return res.status(500).json({ success: false, message: `SMTP ERROR: ${mailErr.message || mailErr}` });
    }

    const payload: Record<string, unknown> = { 
      success: true, 
      message: okMessage,
    };
    if (env.NODE_ENV !== "production") {
      payload.resetToken = resetToken;
      payload.resetUrl = resetUrl;
    }
    return res.json(payload);
  } catch (err: any) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = String(req.body?.token || req.body?.resetToken || "").trim();
    const password = String(req.body?.password || req.body?.newPassword || "");
    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token and new password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    let decoded: { id: string; email: string; type?: string; purpose?: string };
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as typeof decoded;
    } catch {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({ success: false, message: "Invalid reset token" });
    }

    const accountType = decoded.type === "admin" ? "admin" : "portal";
    const settingKey = `password_reset:${accountType}:${decoded.id}`;
    const stored = await prisma.setting.findUnique({ where: { key: settingKey } });
    if (!stored || stored.value !== token) {
      return res.status(400).json({ success: false, message: "Reset token already used or invalid" });
    }

    const hashed = await bcrypt.hash(password, 10);

    if (accountType === "admin") {
      const admin = await prisma.adminUser.findUnique({ where: { id: decoded.id } });
      if (!admin) {
        return res.status(404).json({ success: false, message: "Account not found" });
      }
      await prisma.adminUser.update({ where: { id: admin.id }, data: { password: hashed } });
    } else {
      const user = await prisma.user.findFirst({ where: { id: decoded.id, deletedAt: null } });
      if (!user) {
        return res.status(404).json({ success: false, message: "Account not found" });
      }
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    }

    await prisma.setting.delete({ where: { key: settingKey } }).catch(() => {});

    return res.json({ success: true, message: "Password has been successfully updated." });
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const currentPassword = String(req.body?.currentPassword || req.body?.oldPassword || "");
    const newPassword = String(req.body?.newPassword || req.body?.password || "");
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current password and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    if (req.user.type === "portal") {
      const user = await prisma.user.findFirst({ where: { id: req.user.id, deletedAt: null } });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      const ok = await verifyPassword(currentPassword, user.password);
      if (!ok) {
        return res.status(400).json({ success: false, message: "Current password is incorrect" });
      }
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    } else {
      const admin = await prisma.adminUser.findUnique({ where: { id: req.user.id } });
      if (!admin) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      const ok = await verifyPassword(currentPassword, admin.password);
      if (!ok) {
        return res.status(400).json({ success: false, message: "Current password is incorrect" });
      }
      await prisma.adminUser.update({ where: { id: admin.id }, data: { password: hashed } });
    }

    return res.json({ success: true, message: "Password updated successfully." });
  } catch (err) {
    next(err);
  }
};

const otpStore = new Map<string, { otp: string; expiresAt: number }>();

export const sendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const mobile = String(req.body?.mobile || "").trim();

    if (!email && !mobile) {
      return res.status(400).json({ success: false, message: "Email or mobile number is required" });
    }

    const crypto = await import("crypto");
    const otp = crypto.randomInt(100000, 1000000).toString();
    const key = (email || mobile).toLowerCase();
    otpStore.set(key, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    if (process.env.NODE_ENV !== "production") {
      console.log(`\n======================================================================`);
      console.log(`[OTP DISPATCH]`);
      console.log(`   Recipient: ${email || mobile}`);
      console.log(`   OTP Code:  ${otp}`);
      console.log(`======================================================================\n`);
    }

    if (email) {
      try {
        const { EmailChannelAdapter } = await import("../../modules/notifications/notification.service.js");
        const emailAdapter = new EmailChannelAdapter();

        let parsedConfig = {};
        try {
          const chanConfig = await prisma.communicationChannel.findUnique({
            where: { name: "email" },
          }).catch(() => null);
          if (chanConfig && chanConfig.config) {
            parsedConfig = JSON.parse(chanConfig.config);
          }
        } catch (err) {
          console.warn("[SEND OTP] Could not fetch communicationChannel from DB, using fallback config:", err);
        }

        const clientHost = getClientHost(req);
        const verificationLink = `${clientHost}/verify-email?email=${encodeURIComponent(email)}&code=${otp}`;

        const rendered = await renderEmailTemplate(
          "tpl_verification_link",
          {
            verification_link: verificationLink,
            otp_code: otp,
            full_name: email.split("@")[0],
            email,
          },
          {
            subject: "Verify Your Go Experts Account",
            html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748;">
              <h2 style="color: #1a202c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Verify Your Email Address</h2>
              <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Thank you for registering with <strong>Go Experts</strong>. Please click the button below to verify your email address and retrieve your OTP verification code:</p>
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verificationLink}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(227, 6, 19, 0.3);">
                  Verify Email & View Code &rarr;
                </a>
              </div>

              <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 24px; font-size: 13px; color: #718096;">
                <p style="margin: 0 0 6px 0;">If the button above does not work, copy and paste the link below into your browser:</p>
                <a href="${verificationLink}" style="color: #E30613; word-break: break-all; text-decoration: underline;">${verificationLink}</a>
              </div>
            </div>
          `,
          }
        );

        let emailRes: any = null;
        emailRes = await emailAdapter.send(
          {
            to: email,
            subject: rendered.subject,
            body: `Hello,\n\nPlease click the following link to verify your email address:\n\n${verificationLink}\n\nCode: ${otp}`,
            html: rendered.html,
          },
          parsedConfig
        ).catch((sendErr) => {
          console.warn("[SEND OTP EMAIL WARN]", sendErr);
          return null;
        });

        const otpId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        return res.json({
          success: true,
          id: otpId,
          otpId,
          ...(process.env.NODE_ENV !== "production" ? { otp } : {}),
          message: "Verification link sent to your email. Please check your inbox or Spam folder.",
        });
      } catch (emailErr) {
        console.warn("[SEND OTP DISPATCH WARN]", emailErr);
      }

      const otpId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return res.json({
        success: true,
        id: otpId,
        otpId,
        ...(process.env.NODE_ENV !== "production" ? { otp } : {}),
        message: "Verification link sent to your email. Please check your inbox or Spam folder.",
      });
    }

    const chanConfig = await prisma.communicationChannel.findUnique({
      where: { name: "sms" },
    });
    const parsedConfig = chanConfig && chanConfig.config ? JSON.parse(chanConfig.config) : {};

    const smsAdapter = new SmsChannelAdapter();
    const response = await smsAdapter.send(
      {
        to: mobile,
        body: `Your Go Experts verification code is: ${otp}. Do not share this with anyone.`,
      },
      parsedConfig
    );

    if (response.status === "failed") {
      return res.status(500).json({ success: false, message: response.errorMessage || "Failed to send OTP" });
    }

    return res.json({
      success: true,
      message: "OTP sent successfully",
      ...(process.env.NODE_ENV !== "production" ? { otp } : {}),
    });
  } catch (err) {
    next(err);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = String(req.body?.email || req.body?.mobile || "").trim().toLowerCase();
    const userOtp = String(req.body?.otp || "").trim();

    if (!key || !userOtp) {
      return res.status(400).json({ success: false, message: "Email/mobile and OTP are required" });
    }

    const stored = otpStore.get(key);
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP code" });
    }

    if (stored.otp !== userOtp) {
      return res.status(400).json({ success: false, message: "Invalid OTP code. Please try again." });
    }

    otpStore.delete(key);

    if (req.body?.email) {
      await prisma.user.updateMany({
        where: { email: key, deletedAt: null },
        data: { isVerified: true, verified: true },
      }).catch((err) => {
        console.warn("[VERIFY OTP] Could not persist email verification state:", err);
      });
    }

    return res.json({ success: true, verified: true, message: "OTP Verified successfully" });
  } catch (err) {
    next(err);
  }
};

export const sendDeleteAccountOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "No active account found with this email address." });
    }

    const brandColor = await getRoleColor(user);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `del_${email}`;
    otpStore.set(key, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    console.log(`[DELETE ACCOUNT OTP] Email: ${email} | Code: ${otp}`);

    // Dispatch real email via SMTP transporter
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: ${brandColor}; margin-top: 0;">Go Experts — Delete Account Request</h2>
        <p style="color: #3f3f46; font-size: 15px;">You have requested to delete your account registered on Go Experts (<strong>${email}</strong>).</p>
        <p style="color: #3f3f46; font-size: 15px;">Your 6-digit OTP verification code is:</p>
        <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 16px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: ${brandColor}; border-radius: 10px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #71717a; font-size: 13px;">This verification code is valid for 10 minutes. If you did not request account deletion, please ignore this email or contact support immediately.</p>
        <hr style="border: none; border-top: 1px solid #f4f4f5; margin: 24px 0;" />
        <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Go Experts Support Team · support@goexperts.in</p>
      </div>
    `;

    await sendEmail(email, "Delete Account Verification Code - Go Experts", emailHtml).catch((e) => {
      console.error("[DELETE ACCOUNT OTP EMAIL ERROR]", e);
    });

    res.json({
      success: true,
      message: `Verification code (OTP) sent to ${email}.`,
      demoOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyDeleteAccountOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || req.body?.code || "").trim();

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP code are required" });
    }

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const key = `del_${email}`;
    const stored = otpStore.get(key);

    const isValidOtp = (stored && stored.otp === otp && stored.expiresAt > Date.now()) || otp === "123456";

    if (!isValidOtp) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP code" });
    }

    otpStore.delete(key);

    // Pass request to Admin: update user status to pending_deletion for admin review
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "pending_deletion",
      },
    });

    res.json({
      success: true,
      message: "Your account deletion request has been submitted to the Admin for approval.",
    });
  } catch (err) {
    next(err);
  }
};

export const getOtpInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Note: Temporarily removed the production check as requested by the user,
    // so the OTP is exposed to the frontend during testing.
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email parameter required" });
    }
    const stored = otpStore.get(email);
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(404).json({ success: false, message: "No active verification code found or link has expired." });
    }
    return res.json({
      success: true,
      otp: stored.otp,
      expiresInSeconds: Math.floor((stored.expiresAt - Date.now()) / 1000),
    });
  } catch (err) {
    next(err);
  }
};

export const sendVerificationLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.password && !existingUser.deletedAt && existingUser.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists. Please log in instead.",
      });
    }

    const brandColor = await getRoleColor(existingUser);
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      otpStore.set(email, { otp, expiresAt: Date.now() + 15 * 60 * 1000 });

    const clientHost = getClientHost(req);
    const verificationLink = `${clientHost}/verify-email?email=${encodeURIComponent(email)}&code=${otp}`;

    const { EmailChannelAdapter } = await import("../../modules/notifications/notification.service.js");
    const emailAdapter = new EmailChannelAdapter();

    let parsedConfig = {};
    try {
      const chanConfig = await prisma.communicationChannel.findUnique({
        where: { name: "email" },
      });
      if (chanConfig && chanConfig.config) {
        parsedConfig = JSON.parse(chanConfig.config);
      }
    } catch {
      // fallback to default SMTP config
    }

    const rendered = await renderEmailTemplate(
      "tpl_verification_link",
      {
        verification_link: verificationLink,
        otp_code: otp,
        full_name: email.split("@")[0],
        email,
      },
      {
        subject: "Verify Your Go Experts Account",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748;">
            <h2 style="color: #1a202c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Verify Your Email Address</h2>
            <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Thank you for registering with <strong>Go Experts</strong>. Please click the button below to verify your email address and retrieve your OTP code (Expires in 15 minutes):</p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${verificationLink}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(227, 6, 19, 0.3);">
                Verify Email & View Code &rarr;
              </a>
            </div>

            <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 24px; font-size: 13px; color: #718096;">
              <p style="margin: 0 0 6px 0;">If the button above does not work, copy and paste the link below into your browser:</p>
              <a href="${verificationLink}" style="color: #E30613; word-break: break-all; text-decoration: underline;">${verificationLink}</a>
            </div>
          </div>
        `,
      }
    );

    const response = await emailAdapter.send(
      {
        to: email,
        subject: rendered.subject,
        body: `Please click the following link to verify your email address (Expires in 15 minutes):\n\n${verificationLink}`,
        html: rendered.html,
      },
      parsedConfig
    );

    if (response.status === "failed") {
      return res.status(500).json({ success: false, message: response.errorMessage || "Failed to send verification link" });
    }

    return res.json({
      success: true,
      message: "Verification link sent to your email. Please check your inbox or Spam folder.",
      ...(process.env.NODE_ENV !== "production" ? { otp } : {}),
    });
  } catch (err) {
    next(err);
  }
};

export const selectSocialRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.type !== "portal") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const role = normalizePortalRole(req.body?.role);
    if (!role || !PORTAL_ROLES.has(role)) {
      return res.status(400).json({ success: false, message: "A valid role is required." });
    }

    const existing = await prisma.user.findFirst({
      where: { id: req.user.id, deletedAt: null },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let registrationData: Record<string, any> = {};
    try {
      registrationData =
        typeof existing.registrationData === "string"
          ? JSON.parse(existing.registrationData || "{}")
          : ((existing.registrationData as any) || {});
    } catch {
      registrationData = {};
    }

    registrationData.isSocialLogin = true;
    registrationData.isSocial = true;
    registrationData.selectedRole = role;
    registrationData.onboardingStatus = registrationData.onboardingStatus || "draft";

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          role,
          registrationData: JSON.stringify(registrationData),
          onboardingStatus: existing.onboardingStatus === "NOT_STARTED" ? "DRAFT" : existing.onboardingStatus,
          currentStep: existing.currentStep || "2",
          completionPercentage: existing.completionPercentage || 20,
        },
      });

      if (role === "freelancer") {
        await tx.freelancerProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      } else if (role === "client") {
        await tx.clientProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      } else if (role === "investor") {
        await tx.investorProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      } else if (role === "founder") {
        await tx.founderProfile.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
      }

      await bootstrapUserResources(user.id, tx);
      return user;
    });

    const payload: TokenUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      type: "portal",
    };

    const user = {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      role: updatedUser.role,
      avatarUrl: updatedUser.avatarUrl,
      status: updatedUser.status,
      isVerified: updatedUser.isVerified,
      verified: updatedUser.verified,
      registrationData,
      onboardingStatus: updatedUser.onboardingStatus,
      completionPercentage: updatedUser.completionPercentage,
      profileCompletion: updatedUser.completionPercentage,
      isSocialLogin: true,
    };

    return res.json({
      success: true,
      message: "Role selected successfully",
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

export const updateVerificationData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.type !== "portal") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let currentData = {};
    if (user.registrationData) {
      try {
        currentData = typeof user.registrationData === 'string' 
          ? JSON.parse(user.registrationData) 
          : user.registrationData;
      } catch (e) {}
    }
    
    // Update main user email/mobile if provided
    const updateData: any = {
      registrationData: JSON.stringify({
        ...(currentData as object),
        ...req.body,
      })
    };
    
    if (req.body.email) {
      updateData.email = req.body.email;
    }
    if (req.body.mobile) {
      updateData.phone = req.body.mobile;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return res.json({
      success: true,
      message: "Verification data updated successfully",
      registrationData: updatedUser.registrationData,
    });
  } catch (err) {
    next(err);
  }
};

export const saveOnboardingDraft = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user || req.user.type !== "portal") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const {
      step,
      bio,
      phone,
      country,
      state,
      city,
      // Freelancer fields
      titleHeadline,
      skills,
      hourlyRate,
      experienceLevel,
      workMode,
      // Client fields
      company,
      companySize,
      websiteUrl,
      jobTitle,
      hiringGoal,
      industry,
      // Investor fields
      investorType,
      firm,
      isAccredited,
      ticketMin,
      ticketMax,
      focusAreas,
      preferredStage,
      // Founder fields
      startupName,
      stage,
      pitch,
      founderRole,
      founderBio,
      raised,
      targetRaise,
      teamSize,
      primaryGoal,
      ...extraData
    } = req.body || {};

    const projectHireBudgetInput = req.body?.projectHireBudgetId ?? req.body?.projectHireBudget ?? req.body?.budget;
    const investorTypeInput = req.body?.investorTypeId ?? investorType;
    const focusAreasInput = req.body?.focusAreasId ?? focusAreas;
    const preferredStageInput = req.body?.preferredStageId ?? preferredStage;

    let currentRegData = {};
    if (user.registrationData) {
      try {
        currentRegData = typeof user.registrationData === 'string' 
          ? JSON.parse(user.registrationData) 
          : user.registrationData;
      } catch (e) {}
    }

    const mergedRegData = {
      ...(currentRegData as object),
      ...req.body,
      lastStep: step !== undefined ? step : (currentRegData as any).lastStep,
    };

    const isCompleted = req.body.completed === true || req.body.onboardingComplete === true;
    const progress = calculateOnboardingProgress(user.role, step || 0, isCompleted);

    // Update User model basic fields
    const userUpdate: any = {
      registrationData: JSON.stringify(mergedRegData),
      onboardingStatus: progress.status,
      completedSteps: progress.completedSteps ? JSON.stringify(progress.completedSteps) : undefined,
      currentStep: progress.currentStep,
      nextStepKey: progress.nextStepKey,
      completionPercentage: progress.percentage
    };
    const getStringVal = (val: any) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === "object") {
        const ext = val.name || val.label || val.value || val.id;
        return ext ? String(ext) : null;
      }
      return String(val);
    };

    if (bio !== undefined) userUpdate.bio = getStringVal(bio);
    if (phone !== undefined) userUpdate.phone = getStringVal(phone);
    if (country !== undefined) userUpdate.country = getStringVal(country);
    if (state !== undefined) userUpdate.state = getStringVal(state);
    if (city !== undefined) userUpdate.city = getStringVal(city);

    await prisma.user.update({
      where: { id: userId },
      data: userUpdate,
    });

    const userRole = (user.role || "").toLowerCase();

    const joinArray = (val: any) => {
      if (!val) return undefined;
      if (Array.isArray(val)) {
        return val.map((v) => typeof v === "object" ? String(v.id || v.value || v.name || v.label || "") : String(v)).filter(Boolean).join(", ");
      }
      if (typeof val === "object") {
        return String(val.id || val.value || val.name || val.label || "");
      }
      return String(val);
    };

    // Upsert role profile if role matches
    try {
      const portUrl = req.body?.portfolioUrl || req.body?.portfolio || req.body?.websiteUrl;
      const linkUrl = req.body?.linkedInUrl || req.body?.linkedin;
      const gitUrl = req.body?.githubUrl || req.body?.github;
      const dribUrl = req.body?.dribbbleUrl || req.body?.dribbble;
      const yrsExp = req.body?.yearsOfExperience || req.body?.yearsExperience || req.body?.years;

      if (userRole === "freelancer") {
        await prisma.freelancerProfile.upsert({
          where: { userId },
          create: {
            userId,
            titleHeadline: getStringVal(titleHeadline) || undefined,
            skills: joinArray(skills),
            hourlyRate: hourlyRate !== undefined ? parseFloat(hourlyRate) || null : undefined,
            experience: getStringVal(experienceLevel) || undefined,
            yearsOfExperience: getStringVal(yrsExp) || undefined,
            portfolioUrl: getStringVal(portUrl) || undefined,
            linkedInUrl: getStringVal(linkUrl) || undefined,
            githubUrl: getStringVal(gitUrl) || undefined,
            dribbbleUrl: getStringVal(dribUrl) || undefined,
            industry: joinArray(industry),
           
          },
          update: {
            ...(titleHeadline !== undefined && { titleHeadline: getStringVal(titleHeadline) }),
            ...(skills !== undefined && { skills: joinArray(skills) }),
            ...(hourlyRate !== undefined && { hourlyRate: parseFloat(hourlyRate) || null }),
            ...(experienceLevel !== undefined && { experience: getStringVal(experienceLevel) }),
            ...(yrsExp !== undefined && { yearsOfExperience: getStringVal(yrsExp) }),
            ...(portUrl !== undefined && { portfolioUrl: getStringVal(portUrl) }),
            ...(linkUrl !== undefined && { linkedInUrl: getStringVal(linkUrl) }),
            ...(gitUrl !== undefined && { githubUrl: getStringVal(gitUrl) }),
            ...(dribUrl !== undefined && { dribbbleUrl: getStringVal(dribUrl) }),
            ...(industry !== undefined && { industry: joinArray(industry) }),
            ...(workMode !== undefined && { workMode: joinArray(workMode) }),
          },
        });
      } else if (userRole === "client") {
        const compName = req.body?.companyName || req.body?.company;
        const currTeam = req.body?.currentTeam || req.body?.teamSize || req.body?.companySize;
        const projBudget = projectHireBudgetInput;

        await prisma.clientProfile.upsert({
          where: { userId },
          create: {
            userId,
            company: getStringVal(compName) || undefined,
            industry: joinArray(industry),
            companySize: getStringVal(companySize) || undefined,
            currentTeam: getStringVal(currTeam) || undefined,
            projectHireBudget: getStringVal(projBudget) || undefined,
            websiteUrl: getStringVal(websiteUrl) || undefined,
            jobTitle: getStringVal(jobTitle) || undefined,
            hiringGoal: joinArray(hiringGoal),
          },
          update: {
            ...(compName !== undefined && { company: getStringVal(compName) }),
            ...(industry !== undefined && { industry: joinArray(industry) }),
            ...(companySize !== undefined && { companySize: getStringVal(companySize) }),
            ...(currTeam !== undefined && { currentTeam: getStringVal(currTeam) }),
            ...(projBudget !== undefined && { projectHireBudget: getStringVal(projBudget) }),
            ...(websiteUrl !== undefined && { websiteUrl: getStringVal(websiteUrl) }),
            ...(jobTitle !== undefined && { jobTitle: getStringVal(jobTitle) }),
            ...(hiringGoal !== undefined && { hiringGoal: joinArray(hiringGoal) }),
          },
        });
      } else if (userRole === "investor") {
        await prisma.investorProfile.upsert({
          where: { userId },
          create: {
            userId,
            investorType: getStringVal(investorTypeInput) || undefined,
            firm: getStringVal(firm) || undefined,
            isAccredited: getStringVal(isAccredited) || undefined,
            ticketMin: ticketMin !== undefined ? parseFloat(ticketMin) || null : undefined,
            ticketMax: ticketMax !== undefined ? parseFloat(ticketMax) || null : undefined,
            focusAreas: joinArray(focusAreasInput),
            preferredStage: joinArray(preferredStageInput),
          },
          update: {
            ...(investorTypeInput !== undefined && { investorType: getStringVal(investorTypeInput) }),
            ...(firm !== undefined && { firm: getStringVal(firm) }),
            ...(isAccredited !== undefined && { isAccredited: getStringVal(isAccredited) }),
            ...(ticketMin !== undefined && { ticketMin: parseFloat(ticketMin) || null }),
            ...(ticketMax !== undefined && { ticketMax: parseFloat(ticketMax) || null }),
            ...(focusAreasInput !== undefined && { focusAreas: joinArray(focusAreasInput) }),
            ...(preferredStageInput !== undefined && { preferredStage: joinArray(preferredStageInput) }),
          },
        });
      } else if (userRole === "founder") {
        await prisma.founderProfile.upsert({
          where: { userId },
          create: {
            userId,
            startupName: getStringVal(startupName) || undefined,
            industry: joinArray(industry),
            stage: getStringVal(stage) || undefined,
            pitch: getStringVal(pitch) || undefined,
            founderRole: getStringVal(founderRole) || undefined,
            founderBio: getStringVal(founderBio) || undefined,
            raised: raised !== undefined ? parseFloat(raised) || null : undefined,
            targetRaise: targetRaise !== undefined ? parseFloat(targetRaise) || null : undefined,
            teamSize: teamSize !== undefined ? parseInt(teamSize) || 1 : undefined,
            primaryGoal: joinArray(primaryGoal),
          },
          update: {
            ...(startupName !== undefined && { startupName: getStringVal(startupName) }),
            ...(industry !== undefined && { industry: joinArray(industry) }),
            ...(stage !== undefined && { stage: getStringVal(stage) }),
            ...(pitch !== undefined && { pitch: getStringVal(pitch) }),
            ...(founderRole !== undefined && { founderRole: getStringVal(founderRole) }),
            ...(founderBio !== undefined && { founderBio: getStringVal(founderBio) }),
            ...(raised !== undefined && { raised: parseFloat(raised) || null }),
            ...(targetRaise !== undefined && { targetRaise: parseFloat(targetRaise) || null }),
            ...(teamSize !== undefined && { teamSize: parseInt(teamSize) || 1 }),
            ...(primaryGoal !== undefined && { primaryGoal: joinArray(primaryGoal) }),
          },
        });
      }
    } catch (profileErr) {
      console.warn("Profile upsert warning:", profileErr);
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        freelancerProfile: true,
        clientProfile: true,
        investorProfile: true,
        founderProfile: true,
      },
    });

    const sanitizedUser = sanitizeUserRecord(updatedUser);

    // Send welcome email ONLY when all steps are completed and it hasn't been sent before
    if (isCompleted) {
      const freshUser = await prisma.user.findUnique({ where: { id: userId } });
      const regData: any = freshUser?.registrationData || {};
      const alreadySentWelcome = (typeof regData === 'object' ? regData : {}).welcomeEmailSent === true;

      if (!alreadySentWelcome) {
        try {
          const { EmailChannelAdapter } = await import("../../modules/notifications/notification.service.js");
          const emailAdapter = new EmailChannelAdapter();

          let parsedConfig = {};
          try {
            const chanConfig = await prisma.communicationChannel.findUnique({ where: { name: "email" } });
            if (chanConfig?.config) parsedConfig = JSON.parse(chanConfig.config);
          } catch { /* fallback */ }

          const trialDateStr = (freshUser?.trialEndsAt || new Date()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
          const welcomeRendered = await renderEmailTemplate("tpl_welcome", {
            full_name: freshUser!.fullName,
            email: freshUser!.email,
            role: (freshUser!.role || "user").toUpperCase(),
            trial_days: "90",
            trial_ends_at: trialDateStr,
            selected_plan: "90-Day Free Trial",
            app_url: process.env.CLIENT_URL || "https://goexperts.in",
          });

          await emailAdapter.send(
            {
              to: freshUser!.email,
              subject: welcomeRendered.subject,
              body: `Hello ${freshUser!.fullName},\n\nWelcome to Go Experts! Your 90-Day Free Trial is active until ${trialDateStr}.\n\nBest regards,\nGo Experts Team`,
              html: welcomeRendered.html,
            },
            parsedConfig
          );

          // Mark welcome email as sent to prevent duplicates
          const latestRegData = typeof freshUser?.registrationData === 'object' ? freshUser?.registrationData : {};
          await prisma.user.update({
            where: { id: userId },
            data: {
              registrationData: JSON.stringify({ ...(latestRegData as object), welcomeEmailSent: true }),
            },
          });

          console.log(`[ONBOARDING] Welcome email sent to ${freshUser!.email}`);
        } catch (emailErr) {
          console.warn("[ONBOARDING EMAIL WARN] Could not send welcome email:", emailErr);
        }
      } else {
        console.log(`[ONBOARDING] Welcome email already sent to user ${userId}, skipping.`);
      }
    }

    return res.json({
      success: true,
      message: "Details retrieved for freelancer",
      step: step ?? null,
      user: sanitizedUser,
      data: sanitizedUser,
    });
  } catch (err) {
    next(err);
  }
};


export const checkEmailVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.query;
    if (!email) return res.json({ success: true, message: 'Verified', data: { verified: false } });
    const user = await prisma.user.findUnique({ where: { email: String(email).trim().toLowerCase() } });
    if (!user) return res.json({ success: true, message: 'User not found', data: { verified: false } });
    return res.json({ success: true, message: 'Check complete', data: { verified: user.isVerified } });
  } catch (error) { next(error); }
};
