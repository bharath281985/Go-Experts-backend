import { prisma } from '../../config/database.js';
import { sendFreePlanActivatedEmail, sendPlanExpiredEmail, sendReferralCashbackEmail } from './email.service.js';
import { NotificationEngine } from './notification.engine.js';
import { getSettingsSection } from '../settings/settings.service.js';
import { getVerificationStats } from '../../common/helpers/verification.js';

export type BillingCycle = 'monthly' | 'yearly';

const GST_RATE_FOR_INCLUDED_PLAN_PRICE = 0.18;

const getPlanBaseAmountExcludingGst = (amountIncludingGst: number) => {
  const amount = Number(amountIncludingGst || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return parseFloat((amount / (1 + GST_RATE_FOR_INCLUDED_PLAN_PRICE)).toFixed(2));
};

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

const normalizeRoleForPlan = (role?: string | null) => {
  const value = String(role || 'freelancer').toLowerCase().trim();
  if (value.includes('client') || value.includes('business') || value.includes('employer')) return 'client';
  if (value.includes('founder') || value.includes('startup')) return 'founder';
  if (value.includes('investor')) return 'investor';
  return 'freelancer';
};

const computePlanEndDate = (duration?: string | null) => {
  const endDate = new Date();
  const normalized = String(duration || 'monthly').toLowerCase().trim();
  if (normalized.includes('year')) endDate.setFullYear(endDate.getFullYear() + 1);
  else if (normalized.includes('quarter')) endDate.setMonth(endDate.getMonth() + 3);
  else if (normalized.includes('week')) endDate.setDate(endDate.getDate() + 7);
  else if (normalized.includes('day')) endDate.setDate(endDate.getDate() + 1);
  else if (normalized.includes('90')) endDate.setDate(endDate.getDate() + 90);
  else endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
};

const resolveRoleFreePlan = async (role?: string | null) => {
  const normalizedRole = normalizeRoleForPlan(role);
  const roleLabel = normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1);
  const freeNameFilters = [
    { name: { contains: 'Starter' } },
    { name: { contains: 'Free' } },
    { name: { contains: 'starter' } },
    { name: { contains: 'free' } },
  ];

  const rolePlan = await prisma.subscriptionPlan.findFirst({
    where: {
      status: 'active',
      role: normalizedRole,
      OR: [{ amount: 0 }, ...freeNameFilters],
    },
    orderBy: { amount: 'asc' },
  });
  if (rolePlan) return rolePlan;

  const planName = `${roleLabel} Starter`;
  return prisma.subscriptionPlan.create({
    data: {
      name: planName,
      role: normalizedRole,
      amount: 0,
      currency: 'INR',
      duration: 'monthly',
      features: JSON.stringify(['Role dashboard access', 'Verified account tools', 'Basic discovery access']),
      limits: JSON.stringify({ projects: 1, proposals: 5, connections: 10 }),
      visibility: 'public',
      status: 'active',
    },
  }).catch(async () => {
    const fallback = await prisma.subscriptionPlan.findFirst({
      where: { status: 'active', role: normalizedRole, OR: [{ amount: 0 }, ...freeNameFilters] },
      orderBy: { amount: 'asc' },
    });
    return fallback || ensureFreeStarterPlan(normalizedRole);
  });
};

export const activateFreePlanAfterKyc = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return null;

  const existingActive = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
  if (existingActive) return existingActive;

  const plan = await resolveRoleFreePlan(user.role);
  const now = new Date();

  const subscription = await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { userId, status: { in: ['pending', 'trial'] } },
      data: { status: 'cancelled', cancelledAt: now, cancellationReason: 'Free plan activated after KYC verification' },
    }).catch(() => null);

    const created = await tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'active',
        startDate: now,
        endDate: computePlanEndDate(plan.duration),
        autoRenew: false,
      },
      include: { plan: true },
    });

    await tx.subscriptionHistory.create({
      data: {
        userId,
        planId: plan.id,
        action: 'free_plan_activated_after_kyc',
        metadata: JSON.stringify({ source: 'kyc_verified', activatedAt: now.toISOString() }),
      },
    }).catch(() => null);

    await tx.subscriptionTransaction.create({
      data: {
        subscriptionId: created.id,
        type: 'free_activation',
        amount: 0,
        currency: plan.currency || 'INR',
        gateway: 'system',
        transactionRef: `free-kyc-${created.id}`,
        status: 'success',
      },
    }).catch(() => null);

    return created;
  });

  await reactivateAccountAfterPlanUpgrade(userId).catch(() => null);
  await sendFreePlanActivatedEmail(
    user.email,
    user.fullName || 'User',
    user.role || 'user',
    subscription.plan?.name || plan.name || 'Free Plan',
    subscription.endDate,
  ).catch((error) => console.error('Free plan activation email error:', error));

  return subscription;
};


export const getKycApprovedCurrentSubscription = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      freelancerProfile: true,
      clientProfile: true,
      founderProfile: true,
      investorProfile: true,
    },
  });

  if (!user) return null;

  const verificationStats = getVerificationStats(user);
  if (!verificationStats.kycApproved) return null;

  return prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
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
        const planBaseAmount = getPlanBaseAmountExcludingGst(plan.amount);
        
        const cashbackAmount = parseFloat((planBaseAmount * cashbackMultiplier).toFixed(2));
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
              description: `${cashbackPercent}% Cashback on GST-exclusive subscription base amount for ${referral.referee.fullName}`,
              balanceAfter: newBalance,
              status: 'completed',
            },
          });

          await prisma.referralReward.create({
            data: {
              referralId: referral.id,
              amount: cashbackAmount,
              points: 0,
            }
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
            title: 'Cashback Credited Successfully! 🎉',
            message: `You received 💰${cashbackAmount} cashback (${cashbackPercent}%) because your friend ${referral.referee.fullName} bought a subscription plan!`,
            channel: 'all',
            payload: { amount: cashbackAmount, baseAmount: planBaseAmount, grossAmount: plan.amount, friend: referral.referee.fullName },
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
