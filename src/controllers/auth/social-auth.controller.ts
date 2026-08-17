import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { importPKCS8, SignJWT, createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import jwt from "jsonwebtoken";

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
  const role = req.query.role as string || "freelancer";

  res.cookie("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });

  res.cookie("social_oauth_role", role, {
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
      console.error("[GoogleAuth] State mismatch:", { received: state, cookie: req.cookies.google_oauth_state });
      return res.status(400).json({ message: "Invalid Google authentication state" });
    }

    const googleClient = getGoogleClient();
    const { tokens } = await googleClient.getToken(code as string);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error("Invalid Google token payload");

    const { sub: googleUserId, email, given_name, family_name, picture } = payload;

    // Find linked account
    let authIdentity = await prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: "GOOGLE", providerUserId: googleUserId } },
      include: { user: true }
    });

    let user;
    let isNewUser = false;
    const requestedRole = req.cookies.social_oauth_role || "freelancer";

    if (authIdentity) {
      user = authIdentity.user;
    } else {
      // Find by email or create new
      if (email) {
        user = await prisma.user.findUnique({ where: { email } });
      }

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: {
            email: email || `${googleUserId}@google.placeholder.com`,
            fullName: [given_name, family_name].filter(Boolean).join(" ") || "Google User",
            avatarUrl: picture,
            isVerified: true,
            verified: true,
            role: requestedRole,
            authIdentities: {
              create: {
                provider: "GOOGLE",
                providerUserId: googleUserId,
                email: email
              }
            }
          }
        });
      } else {
        // Link existing user
        await prisma.authIdentity.create({
          data: {
            userId: user.id,
            provider: "GOOGLE",
            providerUserId: googleUserId,
            email: email
          }
        });
      }
    }

    const authToken = generateYourJwt(user);
    res.clearCookie("google_oauth_state");

    const redirectUrl = isNewUser
      ? `${process.env.FRONTEND_URL}/register/step-2?token=${authToken}`
      : `${process.env.FRONTEND_URL}/auth/social-success?token=${authToken}`;

    return res.redirect(redirectUrl);

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
  const role = req.query.role as string || "freelancer";

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

  res.cookie("social_oauth_role", role, {
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
    const { code, state, user: appleUserRaw, error } = req.body;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=apple_cancelled`);
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

    const appleUserId = appleIdentity.sub!;
    const email = appleIdentity.email as string | undefined;

    let firstName, lastName;
    if (appleUserRaw) {
      try {
        const appleUser = JSON.parse(appleUserRaw);
        firstName = appleUser?.name?.firstName?.trim();
        lastName = appleUser?.name?.lastName?.trim();
      } catch { }
    }

    let authIdentity = await prisma.authIdentity.findUnique({
      where: { provider_providerUserId: { provider: "APPLE", providerUserId: appleUserId } },
      include: { user: true }
    });

    let user;
    let isNewUser = false;
    const requestedRole = req.cookies.social_oauth_role || "freelancer";

    if (authIdentity) {
      user = authIdentity.user;
    } else {
      if (email) user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: {
            email: email || `${appleUserId}@apple.placeholder.com`,
            fullName: [firstName, lastName].filter(Boolean).join(" ") || "Apple User",
            isVerified: true,
            verified: true,
            role: requestedRole,
            authIdentities: {
              create: { provider: "APPLE", providerUserId: appleUserId, email }
            }
          }
        });
      } else {
        await prisma.authIdentity.create({
          data: { userId: user.id, provider: "APPLE", providerUserId: appleUserId, email }
        });
      }
    }

    const authToken = generateYourJwt(user);
    res.clearCookie("apple_oauth_state");
    res.clearCookie("apple_oauth_nonce");

    const redirectUrl = isNewUser
      ? `${process.env.FRONTEND_URL}/register/step-2?token=${authToken}`
      : `${process.env.FRONTEND_URL}/auth/social-success?token=${authToken}`;

    return res.redirect(redirectUrl);

  } catch (error) {
    console.error("Apple auth error:", error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=apple_auth_failed`);
  }
};
