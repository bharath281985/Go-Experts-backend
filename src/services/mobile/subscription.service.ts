import { prisma } from '../../config/database.js';

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

  return subscription;
};

export const isFreePlan = (plan: { amount: number; name?: string | null }) =>
  Number(plan.amount) <= 0 || isFreeAlias(String(plan.name || ''));

export type SubscriptionGate = {
  status: 'active' | 'expired' | 'none';
  planId: string | null;
  planName: string | null;
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
export const resolveUserSubscriptionGate = async (
  userId: string
): Promise<SubscriptionGate> => {
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) {
    return { status: 'none', planId: null, planName: null, subscription: null };
  }

  const planName = sub.plan?.name ?? null;

  if (sub.endDate.getTime() < Date.now()) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'expired' },
    });
    return {
      status: 'expired',
      planId: sub.planId,
      planName,
      subscription: sub,
    };
  }

  return {
    status: 'active',
    planId: sub.planId,
    planName,
    subscription: sub,
  };
};

export const shapeCurrentSubscriptionResponse = (gate: SubscriptionGate) => {
  if (!gate.subscription) {
    return {
      status: gate.status,
      planId: null,
      planName: null,
      plan: null,
    };
  }
  return {
    ...gate.subscription,
    status: gate.status,
    planId: gate.planId,
    planName: gate.planName,
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
