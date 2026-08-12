import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from '../../config/database.js';

// Initialize Firebase Admin safely
const initFirebaseAdmin = () => {
  try {
    if (getApps().length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        initializeApp({
          credential: cert(serviceAccount)
        });
        console.log('Firebase Admin initialized successfully from service account key');
      } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          })
        });
        console.log('Firebase Admin initialized successfully from env vars');
      } else {
        console.info('Firebase Admin NOT initialized (Missing FIREBASE_SERVICE_ACCOUNT_KEY or credentials). Push notifications running in dev mock mode.');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
};

initFirebaseAdmin();

export const saveDeviceToken = async (userId: string, token: string, platform: string, deviceId?: string, deviceName?: string) => {
  try {
    if (deviceId) {
      const existing = await prisma.deviceToken.findFirst({
        where: { userId, deviceId }
      });
      if (existing) {
        await prisma.deviceToken.update({
          where: { id: existing.id },
          data: { token, platform: platform || 'unknown', isActive: true, lastSeenAt: new Date(), updatedAt: new Date() }
        });
        return;
      }
    }

    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId, deviceId, platform: platform || 'unknown', isActive: true, lastSeenAt: new Date(), updatedAt: new Date() },
      create: { userId, token, deviceId, platform: platform || 'unknown', isActive: true },
    });
  } catch (error) {
    console.error('Failed to save device token:', error);
  }
};

export const removeDeviceToken = async (token?: string, deviceId?: string, userId?: string) => {
  try {
    if (token) {
      await prisma.deviceToken.deleteMany({ where: { token } });
    } else if (deviceId && userId) {
      await prisma.deviceToken.deleteMany({ where: { deviceId, userId } });
    }
  } catch (error) {
    console.error('Failed to remove device token:', error);
  }
};

export const sendPushNotification = async (userId: string, title: string, body: string, data?: any): Promise<boolean> => {
  if (getApps().length === 0) {
    console.log(`[DEV MODE] Push skipped for User ${userId}. Title: ${title}`);
    return true; // Simulate success
  }

  try {
    const tokens = await prisma.deviceToken.findMany({ where: { userId, isActive: true } });
    if (tokens.length === 0) {
      console.log(`No active device tokens found for User ${userId}`);
      return false; // Can't deliver, maybe retry later
    }

    const messages = tokens.map(t => ({
      token: t.token,
      notification: { title, body },
      data: data || {}
    }));

    const response = await getMessaging().sendEach(messages);
    console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);

    // Automatically remove/deactivate invalid or expired FCM tokens
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code;
          if (errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx].token);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await prisma.deviceToken.updateMany({
          where: { token: { in: invalidTokens } },
          data: { isActive: false }
        });
        console.log(`Deactivated ${invalidTokens.length} invalid device tokens.`);
      }
    }

    return response.successCount > 0;
  } catch (error) {
    console.error('Failed to send push notification:', error);
    return false;
  }
};
