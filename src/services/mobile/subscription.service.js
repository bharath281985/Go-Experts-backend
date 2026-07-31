"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSkillDisplayNames = exports.shapeCurrentSubscriptionResponse = exports.resolveUserSubscriptionGate = exports.isFreePlan = exports.activateUserSubscription = exports.computeSubscriptionEndDate = exports.resolveSubscriptionPlan = exports.ensureFreeStarterPlan = void 0;
const db_js_1 = require("../config/db.js");
const isFreeAlias = (value) => {
    const v = value.trim().toLowerCase();
    return v === 'free' || v === 'starter' || v.includes('free') || v.includes('starter');
};
/**
 * Ensures a free Starter plan exists so mobile mock id `free` / name Starter
 * can always activate without PLAN_NOT_FOUND.
 */
const ensureFreeStarterPlan = async (role = 'freelancer') => {
    const existing = await db_js_1.prisma.subscriptionPlan.findFirst({
        where: {
            status: 'active',
            OR: [{ amount: 0 }, { name: 'Starter' }, { name: 'Free' }, { name: 'free' }],
        },
        orderBy: { amount: 'asc' },
    });
    if (existing)
        return existing;
    return db_js_1.prisma.subscriptionPlan.create({
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
exports.ensureFreeStarterPlan = ensureFreeStarterPlan;
const resolveSubscriptionPlan = async (planIdOrName, role) => {
    const key = String(planIdOrName || '').trim();
    if (!key)
        return null;
    let plan = await db_js_1.prisma.subscriptionPlan.findFirst({
        where: {
            status: 'active',
            OR: [{ id: key }, { name: key }],
        },
    });
    if (!plan && isFreeAlias(key)) {
        plan = await db_js_1.prisma.subscriptionPlan.findFirst({
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
            plan = await (0, exports.ensureFreeStarterPlan)(role || 'freelancer');
        }
    }
    return plan;
};
exports.resolveSubscriptionPlan = resolveSubscriptionPlan;
const computeSubscriptionEndDate = (billingCycle = 'monthly') => {
    const endDate = new Date();
    if (billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
    }
    else {
        endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
};
exports.computeSubscriptionEndDate = computeSubscriptionEndDate;
/**
 * Activates (or replaces) the user's active subscription for the given plan.
 */
const activateUserSubscription = async (userId, planIdOrName, billingCycle = 'monthly', role) => {
    const plan = await (0, exports.resolveSubscriptionPlan)(planIdOrName, role);
    if (!plan) {
        throw new Error('PLAN_NOT_FOUND');
    }
    await db_js_1.prisma.subscription.updateMany({
        where: { userId, status: 'active' },
        data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: 'Replaced by new plan',
        },
    });
    const subscription = await db_js_1.prisma.subscription.create({
        data: {
            userId,
            planId: plan.id,
            status: 'active',
            startDate: new Date(),
            endDate: (0, exports.computeSubscriptionEndDate)(billingCycle),
            autoRenew: plan.amount > 0,
        },
        include: { plan: true },
    });
    return subscription;
};
exports.activateUserSubscription = activateUserSubscription;
const isFreePlan = (plan) => Number(plan.amount) <= 0 || isFreeAlias(String(plan.name || ''));
exports.isFreePlan = isFreePlan;
/**
 * Source of truth for whether the user may skip SubscriptionSelectionPage.
 */
const resolveUserSubscriptionGate = async (userId) => {
    const sub = await db_js_1.prisma.subscription.findFirst({
        where: { userId, status: 'active' },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
    });
    if (!sub) {
        return { status: 'none', planId: null, planName: null, subscription: null };
    }
    const planName = sub.plan?.name ?? null;
    if (sub.endDate.getTime() < Date.now()) {
        await db_js_1.prisma.subscription.update({
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
exports.resolveUserSubscriptionGate = resolveUserSubscriptionGate;
const shapeCurrentSubscriptionResponse = (gate) => {
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
exports.shapeCurrentSubscriptionResponse = shapeCurrentSubscriptionResponse;
/** Resolve skill UUIDs (or mixed name/id values) to display names. */
const resolveSkillDisplayNames = async (rawSkills) => {
    const parts = Array.isArray(rawSkills)
        ? rawSkills
        : String(rawSkills || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    if (parts.length === 0)
        return [];
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const ids = parts.filter((p) => uuidLike.test(p));
    const namesById = new Map();
    if (ids.length > 0) {
        const rows = await db_js_1.prisma.skill.findMany({
            where: { id: { in: ids } },
            select: { id: true, name: true },
        });
        for (const row of rows)
            namesById.set(row.id, row.name);
    }
    return parts.map((p) => namesById.get(p) ?? p);
};
exports.resolveSkillDisplayNames = resolveSkillDisplayNames;
