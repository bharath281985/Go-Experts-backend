import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { SmsChannelAdapter } from "../../modules/notifications/notification.service.js";
import { renderEmailTemplate } from "../../services/settings/settings.service.js";

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
        ? { deletedAt: null, OR: [{ email: rawEmail }, { email }] }
        : { deletedAt: null, email };

      user = await prisma.user.findFirst({
        where: userWhere,
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

    prisma.loginAttempt
      .create({ data: { email, ipAddress, userAgent, success: true } })
      .catch(() => {});

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
      },
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
    if (existing && !existing.deletedAt) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists. Please use a different email address.",
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const phone = req.body?.phone ? String(req.body.phone) : null;
    const country = req.body?.country ? String(req.body.country) : null;
    const city = req.body?.city ? String(req.body.city) : null;
    const bio = req.body?.bio ? String(req.body.bio) : null;

    const { email: _email, password: _password, fullName: _fullName, role: _role, phone: _phone, country: _country, city: _city, bio: _bio, ...restData } = req.body || {};
    const registrationData = Object.keys(restData).length > 0 ? restData : undefined;

    const trialEndsAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

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
              city,
              bio,
              registrationData,
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
              city,
              bio,
              registrationData,
            },
          });

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

        await tx.freelancerProfile.upsert({
          where: { userId: created.id },
          create: {
            userId: created.id,
            industry: industryName,
            skills,
            hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
            experience: req.body?.experience ? String(req.body.experience) : null,
            verificationJson: verificationData,
          },
          update: {
            industry: industryName,
            skills,
            hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : null,
            experience: req.body?.experience ? String(req.body.experience) : null,
            verificationJson: verificationData,
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

    try {
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
        // fallback
      }

      const trialDateStr = trialEndsAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const planSelected = req.body?.subscriptionPlan || "90-Day Free Trial";

      const welcomeRendered = await renderEmailTemplate(
        "tpl_welcome",
        {
          full_name: user.fullName,
          email: user.email,
          role: user.role.toUpperCase(),
          trial_days: "90",
          trial_ends_at: trialDateStr,
          selected_plan: planSelected,
          app_url: process.env.CLIENT_URL || "https://goexperts.in",
        },
        {
          subject: "Welcome to Go Experts! Your 90-Day Free Trial is Active 🎉",
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
              <div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613;">
                <img src="https://goexperts.in/assets/img/logo.png" alt="Go Experts" style="max-height: 44px;" />
              </div>
              <div style="padding: 32px 24px;">
                <h2 style="color: #1a202c; font-size: 22px; font-weight: 800; margin-bottom: 12px;">Welcome to Go Experts! 🎉</h2>
                <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Hello <strong>${user.fullName}</strong>, thank you for registering with <strong>Go Experts</strong> as a <strong>${user.role.toUpperCase()}</strong>.</p>
                
                <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 24px 0;">
                  <h3 style="margin: 0 0 10px 0; color: #E30613; font-size: 16px; font-weight: 700;">🎁 90-Day Free Trial Activated!</h3>
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a5568;">Your account has been granted <strong>90 Days of Full Platform Access</strong> with zero commitment.</p>
                  <p style="margin: 0; font-size: 13px; color: #718096;"><strong>Trial Expiry Date:</strong> ${trialDateStr}</p>
                </div>

                <div style="text-align: center; margin-top: 32px;">
                  <a href="${process.env.CLIENT_URL || 'https://goexperts.in'}" target="_blank" style="background-color: #E30613; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Explore Platform Now &rarr;</a>
                </div>
              </div>
            </div>
          `,
        }
      );

      await emailAdapter.send(
        {
          to: user.email,
          subject: welcomeRendered.subject,
          body: `Hello ${user.fullName},\n\nWelcome to Go Experts! Your 90-Day Free Trial is active until ${trialDateStr}.\n\nBest regards,\nGo Experts Team`,
          html: welcomeRendered.html,
        },
        parsedConfig
      );
    } catch (emailErr) {
      console.warn("[REGISTER EMAIL WARN] Could not send welcome email:", emailErr);
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Pending admin verification.",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
      },
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
      });
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          registrationData: user.registrationData,
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
      });
      if (user) {
        return res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            status: user.status,
            registrationData: user.registrationData,
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
          status: updated.status,
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
            status: updated.status,
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

    // Always return the same message to avoid account enumeration
    const okMessage = "If an account exists for that email, password reset instructions have been sent.";

    const admin = await prisma.adminUser.findFirst({
      where: { OR: [{ email }, { email: String(req.body?.email || "").trim() }] },
    });
    const portalUser = !admin
      ? await prisma.user.findFirst({ where: { email, deletedAt: null } })
      : null;

    if (!admin && !portalUser) {
      return res.json({ success: true, message: okMessage });
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

    // Attempt email if SMTP channel exists; never fail the request on mail errors
    try {
      const nodemailer = await import("nodemailer");
      const channel = await prisma.communicationChannel.findFirst({
        where: { name: "email", status: "active" },
      });
      const config = channel?.config ? JSON.parse(channel.config) : null;
      if (config?.host && config?.user) {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: Number(config.port) || 587,
          secure: Boolean(config.secure),
          auth: { user: config.user, pass: config.pass || config.password },
        });
        await transporter.sendMail({
          from: config.from || config.user,
          to: subject.email,
          subject: "Go Experts — Password Reset",
          text: `Reset your password using this link (valid 1 hour):\n\n${resetUrl}\n`,
          html: `<p>Reset your password using this link (valid 1 hour):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        });
      }
    } catch (mailErr) {
      console.warn("[password-reset] email send skipped/failed:", mailErr);
    }

    const payload: Record<string, unknown> = { success: true, message: okMessage };
    if (env.NODE_ENV !== "production") {
      payload.resetToken = resetToken;
      payload.resetUrl = resetUrl;
    }
    return res.json(payload);
  } catch (err) {
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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = (email || mobile).toLowerCase();
    otpStore.set(key, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    console.log(`[OTP DISPATCH] Email: ${email || mobile} | OTP Code: ${otp}`);

    if (email) {
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

      const response = await emailAdapter.send(
        {
          to: email,
          subject: rendered.subject,
          body: `Hello,\n\nPlease click the following link to verify your email address:\n\n${verificationLink}\n\nCode: ${otp}`,
          html: rendered.html,
        },
        parsedConfig
      );

      if (response.status === "failed") {
        console.error(`[SEND OTP FAIL] Could not send OTP to ${email}: ${response.errorMessage}`);
        return res.status(500).json({
          success: false,
          message: response.errorMessage || "Failed to send verification link via email",
        });
      }

      return res.json({
        success: true,
        message: "Verification link sent to your email. Please check your inbox or Spam folder.",
        otp,
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

    return res.json({ success: true, message: "OTP sent successfully", otp });
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
    return res.json({ success: true, message: "OTP Verified successfully" });
  } catch (err) {
    next(err);
  }
};

export const getOtpInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      otp,
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

    const currentData = typeof user.registrationData === "object" && user.registrationData !== null ? user.registrationData : {};
    
    // Update main user email/mobile if provided
    const updateData: any = {
      registrationData: {
        ...currentData,
        ...req.body,
      }
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
