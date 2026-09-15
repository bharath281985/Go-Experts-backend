import { prisma } from '../../config/database.js';
import { sendPlanExpiredEmail, sendReferralCashbackEmail } from './email.service.js';
import { NotificationEngine } from './notification.engine.js';
import { getSettingsSection } from '../settings/settings.service.js';

export type BillingCycle = 'monthly' | 'yearly';

const isFreeAlias = (value: string) => {
  const v = value.trim().toLowerCase();
  return v === 'free' || v === 'starter' || v.includes('free') || v.includes('starter');
};

/**
 * Ensures a free Starter plan exists so mobile mock id `free` / name Starter
 * can always activate without PLAN_NOT_FOUND.
 */
export const ensureFreeStarterPlan = async (role = 'freelancer') => {
  const existing = await prisma.subscriptionPlan.findFirst({
    where: {
      status: 'active',
      OR: [{ amount: 0 }, { name: 'Starter' }, { name: 'Free' }, { name: 'free' }],
    },
    orderBy: { amount: 'asc' },
  });
  if (existing) return existing;

  return prisma.subscriptionPlan.create({
    data: {
      name: 'Starter',
      role,
      amount: 0,
      currency: 'INR',
      duration: 'monthly',
      features: JSON.stringify([
        'Up to 5 proposals / month',
        'Basic profile',
        'Community support',
      ]),
      status: 'active',
      visibility: 'public',
      popular: false,
      recommended: false,
    },
  });
};

export const resolveSubscriptionPlan = async (
  planIdOrName: string,
  role?: string
) => {
  const key = String(planIdOrName || '').trim();
  if (!key) return null;

  let plan = await prisma.subscriptionPlan.findFirst({
    where: {
      status: 'active',
      OR: [{ id: key }, { name: key }],
    },
  });

  if (!plan && isFreeAlias(key)) {
    plan = await prisma.subscriptionPlan.findFirst({
      where: {
        status: 'active',
        OR: [
          { amount: 0 },
          { name: { contains: 'Starter' } },
          { name: { contains: 'Free' } },
          { name: { contains: 'starter' } },
          { name: { contains: 'free' } },
        ],
      },
      orderBy: { amount: 'asc' },
    });
    if (!plan) {
      plan = await ensureFreeStarterPlan(role || 'freelancer');
    }
  }

  return plan;
};

export const computeSubscriptionEndDate = (billingCycle: BillingCycle = 'monthly') => {
  const endDate = new Date();
  if (billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }
  return endDate;
};

/**
 * Activates (or replaces) the user's active subscription for the given plan.
 */
export const activateUserSubscription = async (
  userId: string,
  planIdOrName: string,
  billingCycle: BillingCycle = 'monthly',
  role?: string
) => {
  const plan = await resolveSubscriptionPlan(planIdOrName, role);
  if (!plan) {
    throw new Error('PLAN_NOT_FOUND');
  }

  await prisma.subscription.updateMany({
    where: { userId, status: 'active' },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: 'Replaced by new plan',
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'active',
      startDate: new Date(),
      endDate: computeSubscriptionEndDate(billingCycle),
      autoRenew: plan.amount > 0,
    },
    include: { plan: true },
  });

  await reactivateAccountAfterPlanUpgrade(userId);

  // --- Dynamic Referral Cashback Logic ---
  if (plan.amount > 0) {
    try {
      const referral = await prisma.referral.findUnique({
        where: { refereeId: userId },
        include: { referrer: true, referee: true },
      });

      if (referral && referral.referrer) {
        // Fetch app_settings from DB for cashback config
        const settingsRecord = await prisma.setting.findUnique({ where: { key: "app_settings" } });
        let appSettings: any = {};
        if (settingsRecord) {
          try {
            appSettings = JSON.parse(settingsRecord.value);
          } catch (e) {}
        }
        
        const cashbackPercent = Number(appSettings.cashback_percent ?? 5);
        const cashbackMultiplier = cashbackPercent / 100;
        
        const cashbackAmount = parseFloat((plan.amount * cashbackMultiplier).toFixed(2));
        if (cashbackAmount > 0) {
          const referrerId = referral.referrer.id;
          
          let referrerWallet = await prisma.wallet.findUnique({ where: { userId: referrerId } });
          if (!referrerWallet) {
            referrerWallet = await prisma.wallet.create({
              data: { userId: referrerId, balance: 0 },
            });
          }

          const newBalance = referrerWallet.balance + cashbackAmount;

          const updatedWallet = await prisma.wallet.update({
            where: { id: referrerWallet.id },
            data: { balance: newBalance },
          });

          await prisma.walletTransaction.create({
            data: {
              walletId: updatedWallet.id,
              type: 'referral_cashback',
              amount: cashbackAmount,
              direction: 'credit',
              description: `${cashbackPercent}% Cashback for referral subscription purchase by ${referral.referee.fullName}`,
              balanceAfter: newBalance,
              status: 'completed',
            },
          });

          // Send Email
          await sendReferralCashbackEmail(
            referral.referrer.email,
            referral.referrer.fullName,
            cashbackAmount,
            referral.referee.fullName,
            newBalance
          ).catch(console.error);

          // Send In-App Notification
          await NotificationEngine.queueNotification({
            userId: referrerId,
            type: 'referral_cashback',
            title: 'Cashback Received! 💰',
            message: `You received ₹${cashbackAmount} cashback (${cashbackPercent}%) because your friend ${referral.referee.fullName} bought a subscription plan!`,
            channel: 'in_app',
            payload: { amount: cashbackAmount, friend: referral.referee.fullName },
          }).catch(console.error);
        }
      }
    } catch (err) {
      console.error('Error processing referral cashback:', err);
    }
  }
  // -----------------------------------

  return subscription;
};

export const isFreePlan = (plan: { amount: number; name?: string | null }) =>
  Number(plan.amount) <= 0 || isFreeAlias(String(plan.name || ''));

export type SubscriptionGate = {
  status: 'active' | 'expired' | 'none';
  planId: string | null;
  planName: string | null;
  planExpired: boolean;
  upgradeRequired: boolean;
  reason: string | null;
  expiredAt: Date | null;
  subscription: {
    id: string;
    userId: string;
    planId: string;
    status: string;
    startDate: Date;
    endDate: Date;
    plan?: { name?: string | null; [key: string]: unknown } | null;
    [key: string]: unknown;
  } | null;
};

/**
 * Source of truth for whether the user may skip SubscriptionSelectionPage.
 */
const parseRegistrationData = (raw: unknown): Record<string, any> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return typeof raw === 'object' ? { ...(raw as Record<string, any>) } : {};
};

const inactiveBecausePlanExpired = (registrationData: unknown) => {
  const reg = parseRegistrationData(registrationData);
  return reg.accountInactiveReason === 'subscription_expired' || reg.planExpired === true;
};

const markSubscriptionExpired = async (sub: any, planName: string | null) => {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: sub.userId } }).catch(() => null);
  const reg = parseRegistrationData(user?.registrationData);
  const alreadyEmailedForSubscription = reg.planExpiredEmailSubscriptionId === sub.id;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'expired' },
  }).catch(() => null);

  if (user && user.status === 'active') {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'inactive',
        registrationData: JSON.stringify({
          ...reg,
          planExpired: true,
          planExpiredAt: sub.endDate?.toISOString?.() || now.toISOString(),
          planExpiredSubscriptionId: sub.id,
          planExpiredPlanId: sub.planId,
          planExpiredPlanName: planName,
          accountInactiveReason: 'subscription_expired',
        }),
      },
    }).catch(() => null);
  } else if (user && inactiveBecausePlanExpired(user.registrationData)) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        registrationData: JSON.stringify({
          ...reg,
          planExpired: true,
          planExpiredAt: reg.planExpiredAt || sub.endDate?.toISOString?.() || now.toISOString(),
          planExpiredSubscriptionId: sub.id,
          planExpiredPlanId: sub.planId,
          planExpiredPlanName: planName,
          accountInactiveReason: 'subscription_expired',
        }),
      },
    }).catch(() => null);
  }

  if (user?.email && !alreadyEmailedForSubscription) {
    const emailResult = await sendPlanExpiredEmail(user.email, user.fullName || 'User', user.role || 'user', planName, sub.endDate).catch(() => false);
    if (emailResult === true) {
      const latest = parseRegistrationData((await prisma.user.findUnique({ where: { id: user.id }, select: { registrationData: true } }).catch(() => null))?.registrationData ?? user.registrationData);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          registrationData: JSON.stringify({
            ...latest,
            planExpiredEmailSentAt: now.toISOString(),
            planExpiredEmailSubscriptionId: sub.id,
          }),
        },
      }).catch(() => null);
    }
  }
};

export const isAccountInactiveBecausePlanExpired = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { registrationData: true } }).catch(() => null);
  return inactiveBecausePlanExpired(user?.registrationData);
};

export const reactivateAccountAfterPlanUpgrade = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true, registrationData: true } }).catch(() => null);
  if (user?.status !== 'inactive' || !inactiveBecausePlanExpired(user.registrationData)) return;

  const reg = parseRegistrationData(user.registrationData);
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: 'active',
      registrationData: JSON.stringify({
        ...reg,
        planExpired: false,
        accountInactiveReason: null,
        planReactivatedAt: new Date().toISOString(),
      }),
    },
  }).catch(() => null);
};

export const resolveUserSubscriptionGate = async (
  userId: string
): Promise<SubscriptionGate> => {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) {
    const expiredSub = await prisma.subscription.findFirst({
      where: { userId, status: 'expired' },
      include: { plan: true },
      orderBy: { endDate: 'desc' },
    });
    if (expiredSub) {
      return {
        status: 'expired',
        planId: expiredSub.planId,
        planName: expiredSub.plan?.name ?? null,
        planExpired: true,
        upgradeRequired: true,
        reason: 'subscription_expired',
        expiredAt: expiredSub.endDate,
        subscription: expiredSub,
      };
    }
    return { status: 'none', planId: null, planName: null, planExpired: false, upgradeRequired: true, reason: 'no_subscription', expiredAt: null, subscription: null };
  }

  const planName = sub.plan?.name ?? null;

  if (sub.endDate.getTime() < Date.now()) {
    await markSubscriptionExpired(sub, planName);
    return {
      status: 'expired',
      planId: sub.planId,
      planName,
      planExpired: true,
      upgradeRequired: true,
      reason: 'subscription_expired',
      expiredAt: sub.endDate,
      subscription: { ...sub, status: 'expired' },
    };
  }

  return {
    status: 'active',
    planId: sub.planId,
    planName,
    planExpired: false,
    upgradeRequired: false,
    reason: null,
    expiredAt: null,
    subscription: sub,
  };
};

export const shapeCurrentSubscriptionResponse = (gate: SubscriptionGate) => {
  if (!gate.subscription) {
    return {
      status: gate.status,
      planId: null,
      planName: null,
      planExpired: gate.planExpired,
      upgradeRequired: gate.upgradeRequired,
      reason: gate.reason,
      expiredAt: gate.expiredAt,
      plan: null,
    };
  }
  return {
    ...gate.subscription,
    status: gate.status,
    planId: gate.planId,
    planName: gate.planName,
    planExpired: gate.planExpired,
    upgradeRequired: gate.upgradeRequired,
    reason: gate.reason,
    expiredAt: gate.expiredAt,
    plan: gate.subscription.plan ?? null,
  };
};

/** Resolve skill UUIDs (or mixed name/id values) to display names. */
export const resolveSkillDisplayNames = async (
  rawSkills: string | string[] | null | undefined
): Promise<string[]> => {
  const parts = Array.isArray(rawSkills)
    ? rawSkills
    : String(rawSkills || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  if (parts.length === 0) return [];

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ids = parts.filter((p) => uuidLike.test(p));
  const namesById = new Map<string, string>();

  if (ids.length > 0) {
    const rows = await prisma.skill.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    for (const row of rows) namesById.set(row.id, row.name);
  }

  return parts.map((p) => namesById.get(p) ?? p);
};
