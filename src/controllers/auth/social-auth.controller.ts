import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { importPKCS8, SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import jwt from "jsonwebtoken";

// Role selection now happens post-auth via a dedicated API endpoint.

// Configure Google OAuth Client helper
const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const apiBase = process.env.API_BASE_URL || (process.env.BASE_URL ? `${process.env.BASE_URL}/api` : "https://apiai.goexperts.in/api");
  const callbackUrl = `${apiBase}/auth/google/callback`;

  return new OAuth2Client(clientId, clientSecret, callbackUrl);
};

// Helper to generate access token for Go Experts (matching auth.controller.ts logic)
const generateYourJwt = (user: any) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, type: "portal" },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Helper to generate Registration Transaction JWT
const generateRegistrationTransaction = (provider: string, providerUserId: string, email?: string) => {
  return jwt.sign(
    { provider, providerUserId, email, purpose: "SOCIAL_REGISTRATION" },
    env.JWT_SECRET,
    { expiresIn: "30m", jwtid: crypto.randomBytes(16).toString("hex") }
  );
};

// ==============================
// Google OAuth Flow
// ==============================

export const googleAuthStart = (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const frontendUrl = process.env.FRONTEND_URL || "https://goexperts.in";

  if (!clientId || !clientSecret) {
    console.error("[GoogleAuth] ❌ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in server .env!");
    return res.redirect(`${frontendUrl}/login?error=google_config_missing`);
  }

  const googleClient = getGoogleClient();
  const state = crypto.randomBytes(32).toString("hex");

  res.cookie("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const url = googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
    state,
    prompt: "consent",
  });

  return res.redirect(url);
};

export const googleAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "https://goexperts.in";

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=google_cancelled`);
    }

    if (!state) {
      console.error("[GoogleAuth] state missing from callback query");
      return res.status(400).json({ message: "Missing state parameter" });
    }

    if (state !== req.cookies.google_oauth_state) {
      console.error("[GoogleAuth] State mismatch");
      return res.status(400).json({ message: "Invalid Google authentication state" });
    }

    // CSRF validated, clear state
    res.clearCookie("google_oauth_state");

    const googleClient = getGoogleClient();
    const { tokens } = await googleClient.getToken(code as string);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Google token payload");

    const { sub: googleUserId, email } = payload;

    // 1. Check if AuthIdentity exists
    let authIdentity = await prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: "GOOGLE", providerUserId: googleUserId } },
      include: { user: true }
    });

    if (authIdentity) {
      const user = authIdentity.user;
      
      // Account Status Check
      if (user.status === "SUSPENDED") {
        return res.redirect(`${frontendUrl}/login?error=account_suspended`);
      }
      if (user.status === "BLOCKED" || user.status === "DELETED") {
        return res.redirect(`${frontendUrl}/login?error=account_unavailable`);
      }

      const authToken = generateYourJwt(user);
      return res.redirect(`${frontendUrl}/auth/social-success?token=${authToken}`);
    }

    // 2. AuthIdentity does not exist. Check if email collides with an existing account.
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        // Email Collision: Require Secure Linking
        const regToken = generateRegistrationTransaction("GOOGLE", googleUserId, email);
        return res.redirect(`${frontendUrl}/auth/social-success?requiresLinking=true&regToken=${regToken}&email=${encodeURIComponent(email)}`);
      }
    }

    // 3. Completely new user. Issue Registration Transaction Token.
    const regToken = generateRegistrationTransaction("GOOGLE", googleUserId, email);
    return res.redirect(`${frontendUrl}/auth/social-success?newUser=true&regToken=${regToken}`);

  } catch (error: any) {
    console.error("[GoogleAuth] Auth error:", error?.message || error);
    const reason = encodeURIComponent(error?.message || "unknown");
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed&reason=${reason}`);
  }
};

// ==============================
// Apple OAuth Flow
// ==============================

export const appleAuthStart = async (req: Request, res: Response) => {
  const state = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");

  res.cookie("apple_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  res.cookie("apple_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  const apiBase = process.env.API_BASE_URL || (process.env.BASE_URL ? `${process.env.BASE_URL}/api` : "https://apiai.goexperts.in/api");

  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID || "",
    redirect_uri: `${apiBase}/auth/apple/callback`,
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state,
    nonce,
  });

  return res.redirect(`https://appleid.apple.com/auth/authorize?${params.toString()}`);
};

export async function generateAppleClientSecret() {
  const privateKeyString = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(privateKeyString, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setAudience("https://appleid.apple.com")
    .setSubject(process.env.APPLE_CLIENT_ID!)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

export const appleAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.body;
    const frontendUrl = process.env.FRONTEND_URL || "https://goexperts.in";

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=apple_cancelled`);
    }

    if (!state || state !== req.cookies.apple_oauth_state) {
      return res.status(400).json({ message: "Invalid Apple authentication state" });
    }

    if (!code) {
      return res.status(400).json({ message: "Apple authorization code missing" });
    }

    const clientSecret = await generateAppleClientSecret();
    const body = new URLSearchParams({
      client_id: process.env.APPLE_CLIENT_ID!,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.API_BASE_URL}/auth/apple/callback`,
    });

    const response = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) throw new Error("APPLE_TOKEN_EXCHANGE_FAILED");
    const tokens = (await response.json()) as { id_token: string; access_token?: string };

    const appleJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));
    const { payload: appleIdentity } = await jwtVerify(tokens.id_token, appleJWKS, {
      issuer: "https://appleid.apple.com",
      audience: process.env.APPLE_CLIENT_ID!,
    });

    if (req.cookies.apple_oauth_nonce && appleIdentity.nonce !== req.cookies.apple_oauth_nonce) {
      throw new Error("INVALID_APPLE_NONCE");
    }

    // CSRF & Nonce validated, clear cookies
    res.clearCookie("apple_oauth_state");
    res.clearCookie("apple_oauth_nonce");

    const appleUserId = appleIdentity.sub!;
    const email = appleIdentity.email as string | undefined;

    // 1. Check if AuthIdentity exists
    let authIdentity = await prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: "APPLE", providerUserId: appleUserId } },
      include: { user: true }
    });

    if (authIdentity) {
      const user = authIdentity.user;
      
      // Account Status Check
      if (user.status === "SUSPENDED") {
        return res.redirect(`${frontendUrl}/login?error=account_suspended`);
      }
      if (user.status === "BLOCKED" || user.status === "DELETED") {
        return res.redirect(`${frontendUrl}/login?error=account_unavailable`);
      }

      const authToken = generateYourJwt(user);
      return res.redirect(`${frontendUrl}/auth/social-success?token=${authToken}`);
    }

    // 2. AuthIdentity does not exist. Check if email collides with an existing account.
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        // Email Collision: Require Secure Linking
        const regToken = generateRegistrationTransaction("APPLE", appleUserId, email);
        return res.redirect(`${frontendUrl}/auth/social-success?requiresLinking=true&regToken=${regToken}&email=${encodeURIComponent(email)}`);
      }
    }

    // 3. Completely new user. Issue Registration Transaction Token.
    const regToken = generateRegistrationTransaction("APPLE", appleUserId, email);
    return res.redirect(`${frontendUrl}/auth/social-success?newUser=true&regToken=${regToken}`);

  } catch (error) {
    console.error("Apple auth error:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=apple_auth_failed`);
  }
};

// ==============================
// Social Post-Auth Flows
// ==============================

const PUBLIC_ROLES = new Set(["client", "freelancer", "investor", "founder"]);

export const selectSocialRole = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Registration token missing" });
    }

    const regToken = authHeader.split(" ")[1];
    let payload: any;
    try {
      payload = jwt.verify(regToken, env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Invalid or expired registration token" });
    }

    if (payload.purpose !== "SOCIAL_REGISTRATION") {
      return res.status(401).json({ message: "Invalid token purpose" });
    }

    const { provider, providerUserId, email } = payload;
    if (!provider || !providerUserId) {
      return res.status(400).json({ message: "Invalid registration payload" });
    }

    // Role validation
    const { role } = req.body;
    const normalizedRole = String(role || "").trim().toLowerCase();
    
    if (!PUBLIC_ROLES.has(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role selection. Admin roles cannot be self-provisioned." });
    }

    // Atomically create User, AuthIdentity, and Profile
    const user = await prisma.$transaction(async (tx) => {
      // Ensure no collision
      const existingIdentity = await tx.authIdentity.findUnique({
        where: { provider_providerUserId: { provider, providerUserId } }
      });

      if (existingIdentity) {
        throw new Error("Identity already registered");
      }

      const newUser = await tx.user.create({
        data: {
          email: email || `${providerUserId}@${provider.toLowerCase()}.placeholder.com`,
          fullName: `${provider} User`,
          role: normalizedRole,
          status: "active",
          isVerified: true,
          verified: true,
          onboardingStatus: "IN_PROGRESS",
          currentStep: "STEP_1_BASIC",
          authIdentities: {
            create: {
              provider,
              providerUserId,
              email
            }
          }
        }
      });

      // Create necessary profile shell based on role
      if (normalizedRole === "freelancer") {
        await tx.freelancerProfile.create({ data: { userId: newUser.id } });
      } else if (normalizedRole === "client") {
        await tx.clientProfile.create({ data: { userId: newUser.id } });
      } else if (normalizedRole === "investor") {
        await tx.investorProfile.create({ data: { userId: newUser.id } });
      } else if (normalizedRole === "founder") {
        await tx.founderProfile.create({ data: { userId: newUser.id } });
      }

      return newUser;
    });

    const authToken = generateYourJwt(user);
    return res.status(201).json({ success: true, token: authToken });

  } catch (error: any) {
    console.error("[SelectSocialRole] Error:", error);
    if (error.message === "Identity already registered") {
      return res.status(409).json({ message: "This social account is already registered." });
    }
    return res.status(500).json({ message: "Failed to register social account" });
  }
};

export const linkSocialAccount = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required for linking." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Registration token missing" });
    }

    const regToken = authHeader.split(" ")[1];
    let payload: any;
    try {
      payload = jwt.verify(regToken, env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ message: "Invalid or expired registration token" });
    }

    if (payload.purpose !== "SOCIAL_REGISTRATION") {
      return res.status(401).json({ message: "Invalid token purpose" });
    }

    const { provider, providerUserId } = payload;
    if (!provider || !providerUserId) {
      return res.status(400).json({ message: "Invalid registration payload" });
    }

    // Verify Password Credentials
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Account Status Check
    if (user.status === "SUSPENDED") {
      return res.status(403).json({ message: "Account suspended." });
    }
    if (user.status === "BLOCKED" || user.status === "DELETED") {
      return res.status(403).json({ message: "Account unavailable." });
    }

    // Link Account inside transaction
    await prisma.$transaction(async (tx) => {
      const existingIdentity = await tx.authIdentity.findUnique({
        where: { provider_providerUserId: { provider, providerUserId } }
      });

      if (existingIdentity) {
        throw new Error("Identity already linked");
      }

      await tx.authIdentity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId,
          email: payload.email
        }
      });
    });

    const authToken = generateYourJwt(user);
    return res.status(200).json({ success: true, token: authToken });

  } catch (error: any) {
    console.error("[LinkSocialAccount] Error:", error);
    if (error.message === "Identity already linked") {
      return res.status(409).json({ message: "This social account is already linked to a user." });
    }
    return res.status(500).json({ message: "Failed to link social account" });
  }
};
