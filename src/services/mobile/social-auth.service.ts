import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';

export type SocialIdentity = {
  email: string;
  fullName?: string;
  picture?: string;
  provider: 'google' | 'apple';
  subject: string;
};

const googleAudiences = () =>
  [
    process.env.GOOGLE_CLIENT_ID,        // web oauth (browser login)
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID_2,
    // Flutter app OAuth clients (fallback hardcoded)
    '817575811603-132hevs3ekm6pkrm9phppt8eq1t9m9fs.apps.googleusercontent.com', // web oauth
    '817575811603-sjk8n64ib4a7mt6nrojjtgg5uhti6j0q.apps.googleusercontent.com', // web / server
    '817575811603-m2jfe6l1lunbiunjvmlrilj7p6ig25kt.apps.googleusercontent.com', // android 1
    '817575811603-9u7p66h38chir8ko3nkf6rvpae4r64sn.apps.googleusercontent.com', // android 2
    '817575811603-7pgbim1pbp6ps0h89594hnh9kouj2jgc.apps.googleusercontent.com', // ios
  ].filter((value): value is string => Boolean(value));

const appleAudiences = () =>
  [
    process.env.APPLE_CLIENT_ID,
    process.env.APPLE_BUNDLE_ID,
    'com.doorstephub.goexperts',
  ].filter((value): value is string => Boolean(value));

/**
 * Verifies a native Google Sign-In ID token (not a Firebase token).
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<SocialIdentity> => {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!response.ok) {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }

  const payload = (await response.json()) as {
    aud?: string;
    azp?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    sub?: string;
  };

  const audiences = googleAudiences();
  const audienceOk =
    audiences.length === 0 ||
    (payload.aud != null && audiences.includes(payload.aud)) ||
    (payload.azp != null && audiences.includes(payload.azp));

  if (!audienceOk) {
    throw new Error('INVALID_GOOGLE_TOKEN');
  }

  const emailVerified =
    payload.email_verified === true || payload.email_verified === 'true';
  if (!payload.email || !emailVerified || !payload.sub) {
    throw new Error('GOOGLE_EMAIL_UNAVAILABLE');
  }

  return {
    email: payload.email,
    fullName: payload.name,
    picture: payload.picture,
    provider: 'google',
    subject: payload.sub,
  };
};

type AppleJwk = {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
};

/**
 * Verifies a native Sign in with Apple identity token (not a Firebase token).
 */
export const verifyAppleIdToken = async (
  idToken: string,
  fallbackEmail?: string
): Promise<SocialIdentity> => {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('INVALID_APPLE_TOKEN');
  }

  const keysResponse = await fetch('https://appleid.apple.com/auth/keys');
  if (!keysResponse.ok) {
    throw new Error('APPLE_KEYS_UNAVAILABLE');
  }

  const { keys } = (await keysResponse.json()) as { keys: AppleJwk[] };
  const jwk = keys.find((key) => key.kid === decoded.header.kid);
  if (!jwk) {
    throw new Error('INVALID_APPLE_TOKEN');
  }

  const publicKey = createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: 'jwk',
  });

  const audiences = appleAudiences();
  if (audiences.length === 0) {
    throw new Error('APPLE_AUDIENCE_UNAVAILABLE');
  }
  // jwt.verify expects string | RegExp | non-empty tuple (not string[]).
  const audience: string | [string, ...string[]] =
    audiences.length === 1
      ? audiences[0]
      : ([audiences[0], ...audiences.slice(1)] as [string, ...string[]]);
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience,
  }) as jwt.JwtPayload;

  const email = (payload.email as string | undefined) || fallbackEmail;
  if (!email || !payload.sub) {
    throw new Error('APPLE_EMAIL_UNAVAILABLE');
  }

  return {
    email,
    provider: 'apple',
    subject: payload.sub,
  };
};
