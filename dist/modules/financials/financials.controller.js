import { prisma } from "../../config/database.js";
import { NotificationService } from "../notifications/notification.service.js";
// ============================================================
// HELPERS
// ============================================================
function generateInvoiceNumber() {
    const prefix = "INV";
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
}
function generateContractNumber() {
    const ts = Date.now().toString(36).toUpperCase();
    return `CTR-${ts}`;
}
function addDuration(startDate, duration) {
    const d = new Date(startDate);
    switch (duration) {
        case "monthly":
            d.setMonth(d.getMonth() + 1);
            break;
        case "quarterly":
            d.setMonth(d.getMonth() + 3);
            break;
        case "yearly":
            d.setFullYear(d.getFullYear() + 1);
            break;
        case "weekly":
            d.setDate(d.getDate() + 7);
            break;
        case "daily":
            d.setDate(d.getDate() + 1);
            break;
        default:
            d.setMonth(d.getMonth() + 1);
    }
    return d;
}
function calcGST(amount) {
    return parseFloat((amount * 0.18).toFixed(2));
}
// ============================================================
// 1. SUBSCRIPTION PLAN MANAGEMENT
// ============================================================
export async function listPlans(req, res) {
    try {
        const { role, visibility, status } = req.query;
        const where = {};
        if (role)
            where.role = role;
        if (visibility)
            where.visibility = visibility;
        if (status)
            where.status = status;
        const plans = await prisma.subscriptionPlan.findMany({
            where,
            include: { featureList: true, _count: { select: { subscriptions: true } } },
            orderBy: { amount: "asc" },
        });
        res.json({ success: true, data: plans });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function createPlan(req, res) {
    try {
        const { name, role, amount, currency, duration, features, limits, popular, recommended, visibility, featureList } = req.body;
        const plan = await prisma.$transaction(async (tx) => {
            const p = await tx.subscriptionPlan.create({
                data: {
                    name, role: role || "freelancer", amount, currency: currency || "INR",
                    duration, features: features ? JSON.stringify(features) : null,
                    limits: limits ? JSON.stringify(limits) : null,
                    popular: popular || false, recommended: recommended || false,
                    visibility: visibility || "public",
                },
            });
            if (featureList && Array.isArray(featureList)) {
                for (const f of featureList) {
                    await tx.subscriptionFeature.create({
                        data: { planId: p.id, featureKey: f.featureKey, featureValue: f.featureValue, limit: f.limit || null },
                    });
                }
            }
            return tx.subscriptionPlan.findUnique({ where: { id: p.id }, include: { featureList: true } });
        });
        res.status(201).json({ success: true, data: plan });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function updatePlan(req, res) {
    try {
        const { id } = req.params;
        const { name, role, amount, currency, duration, features, limits, popular, recommended, visibility, status } = req.body;
        const plan = await prisma.subscriptionPlan.update({
            where: { id },
            data: {
                ...(name && { name }), ...(role && { role }), ...(amount !== undefined && { amount }),
                ...(currency && { currency }), ...(duration && { duration }),
                ...(features && { features: JSON.stringify(features) }),
                ...(limits && { limits: JSON.stringify(limits) }),
                ...(popular !== undefined && { popular }), ...(recommended !== undefined && { recommended }),
                ...(visibility && { visibility }), ...(status && { status }),
            },
        });
        res.json({ success: true, data: plan });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 2. SUBSCRIPTION PURCHASE & LIFECYCLE
// ============================================================
export async function purchaseSubscription(req, res) {
    try {
        const { userId, planId, gateway, transactionId, couponCode } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId } });
            if (!plan || plan.status !== "active")
                throw new Error("Plan not available");
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (!user)
                throw new Error("User not found");
            // Cancel existing active subscription
            await tx.subscription.updateMany({
                where: { userId, status: "active" },
                data: { status: "expired" },
            });
            let discountAmount = 0;
            let couponId = null;
            // Apply coupon if provided
            if (couponCode) {
                const coupon = await tx.coupon.findUnique({ where: { code: couponCode } });
                if (coupon && coupon.status === "active" && coupon.uses < coupon.maxUses) {
                    if (coupon.discountType === "percentage") {
                        discountAmount = parseFloat(((plan.amount * parseFloat(coupon.discount)) / 100).toFixed(2));
                    }
                    else {
                        discountAmount = parseFloat(coupon.discount);
                    }
                    couponId = coupon.id;
                    await tx.coupon.update({ where: { id: coupon.id }, data: { uses: { increment: 1 } } });
                    await tx.couponUsage.create({
                        data: { couponId: coupon.id, userId, discountAmount },
                    });
                }
            }
            const finalAmount = Math.max(0, plan.amount - discountAmount);
            const gst = calcGST(finalAmount);
            const total = parseFloat((finalAmount + gst).toFixed(2));
            const now = new Date();
            const endDate = addDuration(now, plan.duration);
            // Create subscription
            const subscription = await tx.subscription.create({
                data: {
                    userId, planId, status: "active", autoRenew: true,
                    startDate: now, endDate,
                },
            });
            // Create payment
            const payment = await tx.payment.create({
                data: {
                    userId, subscriptionId: subscription.id,
                    amount: total, currency: plan.currency, gateway: gateway || "razorpay",
                    transactionId: transactionId || `TXN-${Date.now()}`,
                    status: "completed",
                },
            });
            // Create invoice
            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber: generateInvoiceNumber(), userId,
                    subscriptionId: subscription.id,
                    subtotal: finalAmount, gst, discount: discountAmount, total,
                    status: "paid",
                },
            });
            await tx.invoiceItem.create({
                data: {
                    invoiceId: invoice.id,
                    description: `${plan.name} Subscription (${plan.duration})`,
                    amount: finalAmount, tax: gst,
                },
            });
            // Create subscription history
            await tx.subscriptionHistory.create({
                data: {
                    userId, planId, action: "purchased",
                    metadata: JSON.stringify({ paymentId: payment.id, invoiceId: invoice.id }),
                },
            });
            // Create transaction record
            await tx.subscriptionTransaction.create({
                data: {
                    subscriptionId: subscription.id, type: "purchase",
                    amount: total, currency: plan.currency,
                    gateway: gateway || "razorpay",
                    transactionRef: transactionId || payment.transactionId,
                    status: "success",
                },
            });
            return { subscription, payment, invoice };
        });
        // Enqueue notification alerts
        try {
            const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (plan && user) {
                await NotificationService.enqueue({
                    userId, type: "subscription", templateCode: "SUBSCRIPTION_ACTIVATED",
                    channel: "omnichannel", variables: { userName: user.fullName, subscriptionPlan: plan.name, amount: plan.amount.toString() },
                });
                await NotificationService.enqueue({
                    userId, type: "payment", templateCode: "PAYMENT_SUCCESS",
                    channel: "omnichannel", variables: { userName: user.fullName, amount: plan.amount.toString() },
                });
            }
        }
        catch (err) {
            console.error("Failed to enqueue purchase notifications:", err);
        }
        res.status(201).json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function renewSubscription(req, res) {
    try {
        const { subscriptionId, gateway, transactionId } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            const sub = await tx.subscription.findUnique({
                where: { id: subscriptionId },
                include: { plan: true },
            });
            if (!sub || !sub.plan)
                throw new Error("Subscription not found");
            const plan = sub.plan;
            const gst = calcGST(plan.amount);
            const total = parseFloat((plan.amount + gst).toFixed(2));
            const now = new Date();
            const newEnd = addDuration(now, plan.duration);
            const updated = await tx.subscription.update({
                where: { id: subscriptionId },
                data: { status: "active", startDate: now, endDate: newEnd },
            });
            const payment = await tx.payment.create({
                data: {
                    userId: sub.userId, subscriptionId: sub.id,
                    amount: total, currency: plan.currency,
                    gateway: gateway || "razorpay",
                    transactionId: transactionId || `TXN-${Date.now()}`,
                    status: "completed",
                },
            });
            const invoice = await tx.invoice.create({
                data: {
                    invoiceNumber: generateInvoiceNumber(), userId: sub.userId,
                    subscriptionId: sub.id,
                    subtotal: plan.amount, gst, discount: 0, total,
                    status: "paid",
                },
            });
            await tx.invoiceItem.create({
                data: { invoiceId: invoice.id, description: `${plan.name} Renewal (${plan.duration})`, amount: plan.amount, tax: gst },
            });
            await tx.subscriptionHistory.create({
                data: { userId: sub.userId, planId: plan.id, action: "renewed", metadata: JSON.stringify({ paymentId: payment.id }) },
            });
            await tx.subscriptionTransaction.create({
                data: {
                    subscriptionId: sub.id, type: "renewal", amount: total, currency: plan.currency,
                    gateway: gateway || "razorpay", transactionRef: transactionId || payment.transactionId, status: "success",
                },
            });
            return { subscription: updated, payment, invoice };
        });
        // Enqueue renewal notifications
        try {
            const user = await prisma.user.findUnique({ where: { id: result.subscription.userId } });
            const plan = await prisma.subscriptionPlan.findUnique({ where: { id: result.subscription.planId } });
            if (user && plan) {
                await NotificationService.enqueue({
                    userId: user.id, type: "subscription", templateCode: "SUBSCRIPTION_ACTIVATED",
                    channel: "omnichannel", variables: { userName: user.fullName, subscriptionPlan: plan.name, amount: plan.amount.toString() },
                });
                await NotificationService.enqueue({
                    userId: user.id, type: "payment", templateCode: "PAYMENT_SUCCESS",
                    channel: "omnichannel", variables: { userName: user.fullName, amount: plan.amount.toString() },
                });
            }
        }
        catch (err) {
            console.error("Failed to enqueue renewal notifications:", err);
        }
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function cancelSubscription(req, res) {
    try {
        const { subscriptionId, reason } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            const sub = await tx.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
            if (!sub)
                throw new Error("Subscription not found");
            const updated = await tx.subscription.update({
                where: { id: subscriptionId },
                data: { status: "cancelled", autoRenew: false, cancelledAt: new Date(), cancellationReason: reason || "User requested" },
            });
            await tx.subscriptionHistory.create({
                data: { userId: sub.userId, planId: sub.planId, action: "cancelled", metadata: JSON.stringify({ reason }) },
            });
            return updated;
        });
        // Enqueue cancel/expiry notification
        try {
            const user = await prisma.user.findUnique({ where: { id: result.userId } });
            if (user) {
                await NotificationService.enqueue({
                    userId: user.id, type: "subscription", templateCode: "SUBSCRIPTION_EXPIRED",
                    channel: "omnichannel", variables: { userName: user.fullName },
                });
            }
        }
        catch (err) {
            console.error("Failed to enqueue cancellation notification:", err);
        }
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function upgradeSubscription(req, res) {
    try {
        const { subscriptionId, newPlanId, gateway, transactionId } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            const sub = await tx.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });
            if (!sub)
                throw new Error("Subscription not found");
            const newPlan = await tx.subscriptionPlan.findUnique({ where: { id: newPlanId } });
            if (!newPlan || newPlan.status !== "active")
                throw new Error("New plan not available");
            // Prorate remaining days
            const now = new Date();
            const remaining = Math.max(0, (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const totalDays = (sub.endDate.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24);
            const credit = totalDays > 0 ? parseFloat(((remaining / totalDays) * (sub.plan?.amount || 0)).toFixed(2)) : 0;
            const upgradeCost = Math.max(0, newPlan.amount - credit);
            const gst = calcGST(upgradeCost);
            const total = parseFloat((upgradeCost + gst).toFixed(2));
            const newEnd = addDuration(now, newPlan.duration);
            const updated = await tx.subscription.update({
                where: { id: subscriptionId },
                data: { planId: newPlanId, status: "active", startDate: now, endDate: newEnd },
            });
            const payment = await tx.payment.create({
                data: {
                    userId: sub.userId, subscriptionId: sub.id,
                    amount: total, currency: newPlan.currency,
                    gateway: gateway || "razorpay",
                    transactionId: transactionId || `TXN-${Date.now()}`,
                    status: "completed",
                },
            });
            await tx.subscriptionHistory.create({
                data: {
                    userId: sub.userId, planId: newPlanId, action: "upgraded",
                    metadata: JSON.stringify({ previousPlan: sub.planId, credit, paymentId: payment.id }),
                },
            });
            await tx.subscriptionTransaction.create({
                data: {
                    subscriptionId: sub.id, type: "upgrade", amount: total, currency: newPlan.currency,
                    gateway: gateway || "razorpay", transactionRef: transactionId || payment.transactionId, status: "success",
                },
            });
            return { subscription: updated, payment, credit };
        });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 3. USAGE TRACKING
// ============================================================
export async function trackUsage(req, res) {
    try {
        const { subscriptionId, featureKey, used } = req.body;
        const usage = await prisma.subscriptionUsage.upsert({
            where: { subscriptionId_featureKey: { subscriptionId, featureKey } },
            create: { subscriptionId, featureKey, used: used || 1 },
            update: { used: { increment: used || 1 }, lastUsedAt: new Date() },
        });
        res.json({ success: true, data: usage });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function getUsage(req, res) {
    try {
        const { subscriptionId } = req.params;
        const usage = await prisma.subscriptionUsage.findMany({ where: { subscriptionId } });
        res.json({ success: true, data: usage });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 4. WALLET OPERATIONS (Refunds, Bonus, Referral Credits ONLY)
// ============================================================
export async function getWallet(req, res) {
    try {
        const { userId } = req.params;
        let wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            wallet = await prisma.wallet.create({ data: { userId, balance: 0, currency: "INR" } });
        }
        const transactions = await prisma.walletTransaction.findMany({
            where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 50,
        });
        res.json({ success: true, data: { wallet, transactions } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function creditWallet(req, res) {
    try {
        const { userId, amount, type, description } = req.body;
        // type must be: refund, bonus, referral_credit, promotional
        const allowedTypes = ["refund", "bonus", "referral_credit", "promotional"];
        if (!allowedTypes.includes(type)) {
            return res.status(400).json({ success: false, message: `Wallet credit type must be one of: ${allowedTypes.join(", ")}` });
        }
        const result = await prisma.$transaction(async (tx) => {
            let wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
                wallet = await tx.wallet.create({ data: { userId, balance: 0, currency: "INR" } });
            }
            const updated = await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } },
            });
            const txn = await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id, type, amount,
                    direction: "credit", description: description || `${type} credit`,
                    balanceAfter: updated.balance,
                },
            });
            return { wallet: updated, transaction: txn };
        });
        try {
            await NotificationService.enqueue({
                userId, type: "wallet", templateCode: "WALLET_CREDIT",
                channel: "in_app", variables: { amount: String(amount) },
            });
        }
        catch (_) { }
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function debitWallet(req, res) {
    try {
        const { userId, amount, type, description } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet)
                throw new Error("Wallet not found");
            if (wallet.balance < amount)
                throw new Error("Insufficient wallet balance");
            const updated = await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: amount } },
            });
            const txn = await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id, type: type || "debit", amount,
                    direction: "debit", description: description || "Wallet debit",
                    balanceAfter: updated.balance,
                },
            });
            return { wallet: updated, transaction: txn };
        });
        try {
            await NotificationService.enqueue({
                userId, type: "wallet", templateCode: "WALLET_DEBIT",
                channel: "in_app", variables: { amount: String(amount) },
            });
        }
        catch (_) { }
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function addWalletBonus(req, res) {
    try {
        const { userId, amount, reason, expiresAt } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            let wallet = await tx.wallet.findUnique({ where: { userId } });
            if (!wallet) {
                wallet = await tx.wallet.create({ data: { userId, balance: 0, currency: "INR" } });
            }
            const bonus = await tx.walletBonus.create({
                data: { walletId: wallet.id, amount, reason: reason || "Admin bonus", expiresAt: expiresAt ? new Date(expiresAt) : null },
            });
            const updated = await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id, type: "bonus", amount,
                    direction: "credit", description: reason || "Bonus credit",
                    balanceAfter: updated.balance,
                },
            });
            return { wallet: updated, bonus };
        });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 5. PAYMENT & REFUND MANAGEMENT
// ============================================================
export async function listPayments(req, res) {
    try {
        const { status, gateway, userId, page = "1", limit = "20" } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (gateway)
            where.gateway = gateway;
        if (userId)
            where.userId = userId;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where, skip, take: parseInt(limit),
                include: { user: { select: { id: true, fullName: true, email: true } }, subscription: { include: { plan: true } } },
                orderBy: { createdAt: "desc" },
            }),
            prisma.payment.count({ where }),
        ]);
        res.json({ success: true, data: payments, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function processRefund(req, res) {
    try {
        const { paymentId, amount, reason } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({ where: { id: paymentId } });
            if (!payment)
                throw new Error("Payment not found");
            if (payment.status === "refunded")
                throw new Error("Payment already refunded");
            const refundAmount = amount || payment.amount;
            const refund = await tx.paymentRefund.create({
                data: {
                    paymentId, amount: refundAmount, reason: reason || "Admin initiated refund",
                    status: "processed", processedAt: new Date(),
                },
            });
            await tx.payment.update({
                where: { id: paymentId },
                data: { status: refundAmount >= payment.amount ? "refunded" : "partially_refunded" },
            });
            // Credit refund to wallet
            let wallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
            if (!wallet) {
                wallet = await tx.wallet.create({ data: { userId: payment.userId, balance: 0, currency: "INR" } });
            }
            const updated = await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: refundAmount } },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id, type: "refund", amount: refundAmount,
                    direction: "credit", description: `Refund for payment ${payment.transactionId}`,
                    balanceAfter: updated.balance,
                },
            });
            return { refund, walletBalance: updated.balance };
        });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function listRefunds(req, res) {
    try {
        const refunds = await prisma.paymentRefund.findMany({
            include: { payment: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: refunds });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 6. COUPON ENGINE
// ============================================================
export async function validateCoupon(req, res) {
    try {
        const { code, userId, planId } = req.body;
        const coupon = await prisma.coupon.findUnique({ where: { code } });
        if (!coupon)
            return res.status(404).json({ success: false, message: "Coupon not found" });
        if (coupon.status !== "active")
            return res.status(400).json({ success: false, message: "Coupon inactive" });
        if (coupon.uses >= coupon.maxUses)
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
        // Check role filter
        if (coupon.roleFilter && userId) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user && user.role !== coupon.roleFilter) {
                return res.status(400).json({ success: false, message: `Coupon valid only for ${coupon.roleFilter} users` });
            }
        }
        // Check plan filter
        if (coupon.planFilter && planId && coupon.planFilter !== planId) {
            return res.status(400).json({ success: false, message: "Coupon not valid for this plan" });
        }
        // Check already used by user
        if (userId) {
            const used = await prisma.couponUsage.findFirst({ where: { couponId: coupon.id, userId } });
            if (used)
                return res.status(400).json({ success: false, message: "Coupon already used by this user" });
        }
        res.json({ success: true, data: { coupon, valid: true } });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function listCouponUsages(req, res) {
    try {
        const { couponId } = req.params;
        const usages = await prisma.couponUsage.findMany({
            where: { couponId },
            include: { user: { select: { id: true, fullName: true, email: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: usages });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 7. REFERRAL ENGINE
// ============================================================
export async function createReferral(req, res) {
    try {
        const { referrerId, refereeId } = req.body;
        const existing = await prisma.referral.findUnique({ where: { refereeId } });
        if (existing)
            return res.status(400).json({ success: false, message: "Referee already has a referral" });
        const referral = await prisma.referral.create({
            data: {
                referrerId, refereeId,
                link: `https://goexperts.com/ref/${referrerId.substring(0, 8)}`,
                qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=https://goexperts.com/ref/${referrerId.substring(0, 8)}`,
            },
        });
        res.status(201).json({ success: true, data: referral });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function rewardReferral(req, res) {
    try {
        const { referralId, points, amount } = req.body;
        const result = await prisma.$transaction(async (tx) => {
            const referral = await tx.referral.findUnique({ where: { id: referralId } });
            if (!referral)
                throw new Error("Referral not found");
            const reward = await tx.referralReward.create({
                data: { referralId, points: points || 0, amount: amount || 0 },
            });
            await tx.referral.update({ where: { id: referralId }, data: { status: "rewarded" } });
            // Credit wallet for referrer
            if (amount && amount > 0) {
                let wallet = await tx.wallet.findUnique({ where: { userId: referral.referrerId } });
                if (!wallet) {
                    wallet = await tx.wallet.create({ data: { userId: referral.referrerId, balance: 0, currency: "INR" } });
                }
                const updated = await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: { increment: amount } },
                });
                await tx.walletTransaction.create({
                    data: {
                        walletId: wallet.id, type: "referral_credit", amount,
                        direction: "credit", description: "Referral reward credit",
                        balanceAfter: updated.balance,
                    },
                });
            }
            return { reward, referral };
        });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function listReferrals(req, res) {
    try {
        const referrals = await prisma.referral.findMany({
            include: {
                referrer: { select: { id: true, fullName: true, email: true } },
                referee: { select: { id: true, fullName: true, email: true } },
                rewards: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: referrals });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 8. ADVERTISEMENT MANAGEMENT
// ============================================================
export async function listAdPlans(req, res) {
    try {
        const plans = await prisma.advertisementPlan.findMany({
            include: { _count: { select: { advertisements: true } } },
            orderBy: { price: "asc" },
        });
        res.json({ success: true, data: plans });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function createAdPlan(req, res) {
    try {
        const plan = await prisma.advertisementPlan.create({ data: req.body });
        res.status(201).json({ success: true, data: plan });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function listAds(req, res) {
    try {
        const { status } = req.query;
        const where = {};
        if (status)
            where.status = status;
        const ads = await prisma.advertisement.findMany({
            where,
            include: {
                plan: true,
                user: { select: { id: true, fullName: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: ads });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function approveAd(req, res) {
    try {
        const { id } = req.params;
        const ad = await prisma.advertisement.update({
            where: { id },
            data: { status: "active", startDate: new Date() },
        });
        res.json({ success: true, data: ad });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function rejectAd(req, res) {
    try {
        const { id } = req.params;
        const ad = await prisma.advertisement.update({
            where: { id },
            data: { status: "rejected" },
        });
        res.json({ success: true, data: ad });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 9. FEATURED SERVICES
// ============================================================
export async function listFeaturedServices(req, res) {
    try {
        const { status } = req.query;
        const where = {};
        if (status)
            where.status = status;
        const services = await prisma.featuredService.findMany({
            where,
            include: { user: { select: { id: true, fullName: true, email: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: services });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function createFeaturedService(req, res) {
    try {
        const { userId, targetType, targetId, planName, price, durationDays } = req.body;
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + (durationDays || 30));
        const service = await prisma.featuredService.create({
            data: { userId, targetType, targetId, planName, price, endDate },
        });
        res.status(201).json({ success: true, data: service });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 10. INVOICE MANAGEMENT
// ============================================================
export async function listInvoices(req, res) {
    try {
        const { status, userId, page = "1", limit = "20" } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (userId)
            where.userId = userId;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [invoices, total] = await Promise.all([
            prisma.invoice.findMany({
                where, skip, take: parseInt(limit),
                include: {
                    user: { select: { id: true, fullName: true, email: true } },
                    subscription: { include: { plan: true } },
                    items: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.invoice.count({ where }),
        ]);
        res.json({
            success: true, data: invoices,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function getInvoice(req, res) {
    try {
        const { id } = req.params;
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, fullName: true, email: true, phone: true, country: true } },
                subscription: { include: { plan: true } },
                items: true,
            },
        });
        if (!invoice)
            return res.status(404).json({ success: false, message: "Invoice not found" });
        res.json({ success: true, data: invoice });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 11. FINANCIAL DASHBOARD METRICS
// ============================================================
export async function getFinancialDashboard(req, res) {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const [totalRevenue, monthlyRevenue, lastMonthRevenue, activeSubscriptions, totalSubscriptions, totalRefunds, monthlyRefunds, totalWalletBalance, activeCoupons, totalCouponUsages, totalReferrals, rewardedReferrals, activeAds, totalFeatured, totalInvoices, paidInvoices, revenueByPlan, revenueByGateway, subscriptionsByStatus,] = await Promise.all([
            // Total revenue
            prisma.payment.aggregate({ where: { status: "completed" }, _sum: { amount: true } }),
            // Monthly revenue
            prisma.payment.aggregate({ where: { status: "completed", createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
            // Last month revenue
            prisma.payment.aggregate({ where: { status: "completed", createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
            // Active subs
            prisma.subscription.count({ where: { status: "active" } }),
            // Total subs
            prisma.subscription.count(),
            // Total refunds
            prisma.paymentRefund.aggregate({ _sum: { amount: true }, _count: true }),
            // Monthly refunds
            prisma.paymentRefund.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
            // Wallet balance
            prisma.wallet.aggregate({ _sum: { balance: true } }),
            // Coupons
            prisma.coupon.count({ where: { status: "active" } }),
            prisma.couponUsage.count(),
            // Referrals
            prisma.referral.count(),
            prisma.referral.count({ where: { status: "rewarded" } }),
            // Ads
            prisma.advertisement.count({ where: { status: "active" } }),
            prisma.featuredService.count({ where: { status: "active" } }),
            // Invoices
            prisma.invoice.count(),
            prisma.invoice.count({ where: { status: "paid" } }),
            // Revenue by plan - group by plan
            prisma.subscription.findMany({
                where: { status: "active" },
                include: { plan: { select: { name: true, amount: true } } },
            }),
            // Revenue by gateway
            prisma.payment.groupBy({
                by: ["gateway"],
                where: { status: "completed" },
                _sum: { amount: true },
                _count: true,
            }),
            // Subscriptions by status
            prisma.subscription.groupBy({
                by: ["status"],
                _count: true,
            }),
        ]);
        // Process revenue by plan
        const planRevenue = {};
        for (const sub of revenueByPlan) {
            const planName = sub.plan?.name || "Unknown";
            if (!planRevenue[planName])
                planRevenue[planName] = { count: 0, revenue: 0 };
            planRevenue[planName].count++;
            planRevenue[planName].revenue += sub.plan?.amount || 0;
        }
        const currentMR = monthlyRevenue._sum.amount || 0;
        const lastMR = lastMonthRevenue._sum.amount || 0;
        const revenueGrowth = lastMR > 0 ? parseFloat((((currentMR - lastMR) / lastMR) * 100).toFixed(1)) : 0;
        res.json({
            success: true,
            data: {
                overview: {
                    totalRevenue: totalRevenue._sum.amount || 0,
                    monthlyRevenue: currentMR,
                    lastMonthRevenue: lastMR,
                    revenueGrowth,
                    activeSubscriptions,
                    totalSubscriptions,
                    totalRefunds: totalRefunds._sum.amount || 0,
                    refundCount: totalRefunds._count || 0,
                    monthlyRefunds: monthlyRefunds._sum.amount || 0,
                    totalWalletBalance: totalWalletBalance._sum.balance || 0,
                },
                marketing: {
                    activeCoupons,
                    totalCouponUsages,
                    totalReferrals,
                    rewardedReferrals,
                    activeAds,
                    totalFeatured,
                },
                invoicing: {
                    totalInvoices,
                    paidInvoices,
                    unpaidInvoices: totalInvoices - paidInvoices,
                },
                breakdown: {
                    revenueByPlan: planRevenue,
                    revenueByGateway: revenueByGateway.map((g) => ({
                        gateway: g.gateway,
                        total: g._sum.amount || 0,
                        count: g._count,
                    })),
                    subscriptionsByStatus: subscriptionsByStatus.map((s) => ({
                        status: s.status,
                        count: s._count,
                    })),
                },
            },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
// ============================================================
// 12. SUBSCRIPTION HISTORY
// ============================================================
export async function getSubscriptionHistory(req, res) {
    try {
        const { userId } = req.params;
        const history = await prisma.subscriptionHistory.findMany({
            where: { userId },
            include: { plan: { select: { name: true, amount: true, duration: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: history });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
export async function listAllSubscriptions(req, res) {
    try {
        const { status, page = "1", limit = "20" } = req.query;
        const where = {};
        if (status)
            where.status = status;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [subs, total] = await Promise.all([
            prisma.subscription.findMany({
                where, skip, take: parseInt(limit),
                include: {
                    user: { select: { id: true, fullName: true, email: true, role: true } },
                    plan: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.subscription.count({ where }),
        ]);
        res.json({
            success: true, data: subs,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
}
