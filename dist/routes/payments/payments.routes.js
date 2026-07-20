/**
 * Payment gateway scaffolding (Stripe, Razorpay, Easebuzz).
 *
 * Env vars (optional — missing keys fall back to mock checkout):
 *   STRIPE_SECRET_KEY       — Stripe secret key (sk_...)
 *   STRIPE_WEBHOOK_SECRET   — Stripe webhook signing secret (whsec_...)
 *   RAZORPAY_KEY_ID         — Razorpay key id
 *   RAZORPAY_KEY_SECRET     — Razorpay key secret
 *   EASEBUZZ_KEY            — Easebuzz merchant key
 *   EASEBUZZ_SALT           — Easebuzz salt
 */
import { Router } from "express";
import crypto from "crypto";
import Stripe from "stripe";
import { prisma } from "../../config/database.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = Router();
function getStripe() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key)
        return null;
    return new Stripe(key);
}
async function resolveCheckoutUserId(req, bodyUserId) {
    const candidate = bodyUserId || req.user?.id;
    if (!candidate)
        throw new Error("userId required");
    const user = await prisma.user.findFirst({ where: { id: candidate, deletedAt: null } });
    if (!user)
        throw new Error("Portal user not found for payment (userId must reference users table)");
    return user.id;
}
// POST /checkout — auth required
router.post("/checkout", authMiddleware, async (req, res) => {
    try {
        const { gateway, amount, currency, purpose, metadata, userId: bodyUserId } = req.body;
        if (!gateway || !["stripe", "razorpay", "easebuzz"].includes(gateway)) {
            return res.status(400).json({ success: false, message: "gateway must be stripe|razorpay|easebuzz" });
        }
        if (amount == null || Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: "amount must be a positive number" });
        }
        const userId = await resolveCheckoutUserId(req, bodyUserId);
        const cur = (currency || "INR").toUpperCase();
        const metaNote = purpose || (metadata ? JSON.stringify(metadata).slice(0, 200) : undefined);
        if (gateway === "stripe") {
            const stripe = getStripe();
            if (stripe) {
                const intent = await stripe.paymentIntents.create({
                    amount: Math.round(Number(amount) * 100),
                    currency: cur.toLowerCase(),
                    metadata: {
                        purpose: purpose || "",
                        ...(metadata || {}),
                        userId,
                    },
                });
                const payment = await prisma.payment.create({
                    data: {
                        userId,
                        gateway: "stripe",
                        amount: Number(amount),
                        currency: cur,
                        transactionId: intent.id,
                        status: "pending",
                    },
                });
                return res.status(201).json({
                    success: true,
                    data: {
                        payment,
                        checkout: {
                            gateway: "stripe",
                            clientSecret: intent.client_secret,
                            paymentIntentId: intent.id,
                            purpose: metaNote,
                        },
                    },
                });
            }
            const mockId = `mock_pi_${crypto.randomBytes(12).toString("hex")}`;
            const payment = await prisma.payment.create({
                data: {
                    userId,
                    gateway: "stripe",
                    amount: Number(amount),
                    currency: cur,
                    transactionId: mockId,
                    status: "pending",
                },
            });
            return res.status(201).json({
                success: true,
                data: {
                    payment,
                    checkout: {
                        gateway: "stripe",
                        clientSecret: `${mockId}_secret_mock`,
                        paymentIntentId: mockId,
                        mock: true,
                        purpose: metaNote,
                    },
                },
            });
        }
        if (gateway === "razorpay") {
            const keyId = process.env.RAZORPAY_KEY_ID;
            const keySecret = process.env.RAZORPAY_KEY_SECRET;
            let orderId = `order_mock_${crypto.randomBytes(8).toString("hex")}`;
            let order = {
                id: orderId,
                amount: Math.round(Number(amount) * 100),
                currency: cur,
                receipt: `rcpt_${Date.now()}`,
                status: "created",
                mock: !keyId || !keySecret,
            };
            if (keyId && keySecret) {
                try {
                    const Razorpay = (await import("razorpay")).default;
                    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
                    const created = await rzp.orders.create({
                        amount: Math.round(Number(amount) * 100),
                        currency: cur,
                        receipt: `rcpt_${Date.now()}`,
                        notes: { purpose: purpose || "", userId, ...(metadata || {}) },
                    });
                    orderId = String(created.id);
                    order = { ...created, mock: false };
                }
                catch (err) {
                    order = { ...order, gatewayError: err?.message || "razorpay create failed", mock: true };
                }
            }
            const payment = await prisma.payment.create({
                data: {
                    userId,
                    gateway: "razorpay",
                    amount: Number(amount),
                    currency: cur,
                    transactionId: orderId,
                    status: "pending",
                },
            });
            return res.status(201).json({
                success: true,
                data: {
                    payment,
                    checkout: {
                        gateway: "razorpay",
                        order,
                        keyId: keyId || null,
                        purpose: metaNote,
                    },
                },
            });
        }
        // easebuzz
        const easeKey = process.env.EASEBUZZ_KEY;
        const easeSalt = process.env.EASEBUZZ_SALT;
        const txnId = `ease_${crypto.randomBytes(10).toString("hex")}`;
        const order = {
            txnid: txnId,
            amount: Number(amount),
            currency: cur,
            productinfo: purpose || "payment",
            key: easeKey || null,
            hashReady: Boolean(easeKey && easeSalt),
            mock: !easeKey || !easeSalt,
            ...(metadata || {}),
        };
        const payment = await prisma.payment.create({
            data: {
                userId,
                gateway: "easebuzz",
                amount: Number(amount),
                currency: cur,
                transactionId: txnId,
                status: "pending",
            },
        });
        return res.status(201).json({
            success: true,
            data: {
                payment,
                checkout: { gateway: "easebuzz", order, purpose: metaNote },
            },
        });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});
async function markPaymentCompleted(transactionId, fallbackId) {
    if (transactionId) {
        const byTxn = await prisma.payment.findFirst({ where: { transactionId } });
        if (byTxn) {
            return prisma.payment.update({
                where: { id: byTxn.id },
                data: { status: "completed" },
            });
        }
    }
    if (fallbackId) {
        return prisma.payment.update({
            where: { id: fallbackId },
            data: { status: "completed" },
        });
    }
    return null;
}
// POST /webhooks/stripe — no auth (signature optional when secret set)
router.post("/webhooks/stripe", async (req, res) => {
    try {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        let event = req.body;
        if (secret && process.env.STRIPE_SECRET_KEY) {
            const stripe = getStripe();
            const sig = req.headers["stripe-signature"];
            const raw = req.rawBody;
            if (stripe && sig && raw) {
                try {
                    event = stripe.webhooks.constructEvent(raw, sig, secret);
                }
                catch (err) {
                    return res.status(400).json({ success: false, message: `Webhook signature verification failed: ${err.message}` });
                }
            }
        }
        const type = event?.type || event?.event;
        if (type === "payment_intent.succeeded" || type === "charge.succeeded") {
            const obj = event.data?.object || event.payload || {};
            const paymentIntentId = obj.id || obj.payment_intent;
            await markPaymentCompleted(paymentIntentId);
        }
        else if (type === "payment_intent.payment_failed") {
            const obj = event.data?.object || {};
            if (obj.id) {
                const p = await prisma.payment.findFirst({ where: { transactionId: obj.id } });
                if (p)
                    await prisma.payment.update({ where: { id: p.id }, data: { status: "failed" } });
            }
        }
        return res.json({ success: true, received: true });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});
// POST /webhooks/razorpay
router.post("/webhooks/razorpay", async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (secret && req.headers["x-razorpay-signature"]) {
            const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
            const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
            if (expected !== req.headers["x-razorpay-signature"]) {
                return res.status(400).json({ success: false, message: "Invalid Razorpay signature" });
            }
        }
        const event = req.body?.event || req.body?.type;
        const payload = req.body?.payload?.payment?.entity || req.body?.payload || req.body;
        if (event === "payment.captured" || payload?.status === "captured") {
            const orderId = payload?.order_id;
            const paymentId = payload?.id;
            const updated = (await markPaymentCompleted(orderId)) ||
                (paymentId ? await markPaymentCompleted(paymentId) : null);
            if (!updated && orderId) {
                // also try matching by payment id stored as transactionId
            }
        }
        return res.json({ success: true, received: true });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});
// POST /webhooks/easebuzz
router.post("/webhooks/easebuzz", async (req, res) => {
    try {
        const body = req.body || {};
        const txnid = body.txnid || body.txnId || body.transaction_id;
        const statusRaw = String(body.status || body.udf1 || "").toLowerCase();
        if (txnid) {
            const payment = await prisma.payment.findFirst({ where: { transactionId: String(txnid) } });
            if (payment) {
                let status = payment.status;
                if (["success", "successful", "completed", "paid"].includes(statusRaw))
                    status = "completed";
                else if (["failure", "failed", "userCancelled", "bounced"].includes(statusRaw))
                    status = "failed";
                else if (statusRaw)
                    status = statusRaw;
                await prisma.payment.update({ where: { id: payment.id }, data: { status } });
            }
        }
        return res.json({ success: true, received: true });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});
// GET /status/:paymentId — auth
router.get("/status/:paymentId", authMiddleware, async (req, res) => {
    try {
        const payment = await prisma.payment.findUnique({
            where: { id: req.params.paymentId },
            include: { refunds: true },
        });
        if (!payment)
            return res.status(404).json({ success: false, message: "Payment not found" });
        if (req.user?.type === "portal" && payment.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }
        return res.json({ success: true, data: payment });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});
/**
 * POST /refund — marks refund + best-effort gateway call; logs gateway refund id in reason/response
 */
router.post("/refund", authMiddleware, async (req, res) => {
    try {
        const { paymentId, amount, reason } = req.body;
        if (!paymentId)
            return res.status(400).json({ success: false, message: "paymentId required" });
        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment)
            return res.status(404).json({ success: false, message: "Payment not found" });
        if (payment.status === "refunded") {
            return res.status(400).json({ success: false, message: "Payment already refunded" });
        }
        const refundAmount = amount != null ? Number(amount) : payment.amount;
        let gatewayRefundId = null;
        let gatewayNote = null;
        try {
            if (payment.gateway === "stripe" && process.env.STRIPE_SECRET_KEY && payment.transactionId) {
                const stripe = getStripe();
                if (stripe && !payment.transactionId.startsWith("mock_")) {
                    const rf = await stripe.refunds.create({
                        payment_intent: payment.transactionId,
                        amount: Math.round(refundAmount * 100),
                    });
                    gatewayRefundId = rf.id;
                }
                else {
                    gatewayRefundId = `mock_re_${crypto.randomBytes(8).toString("hex")}`;
                    gatewayNote = "mock stripe refund";
                }
            }
            else if (payment.gateway === "razorpay" && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
                try {
                    const Razorpay = (await import("razorpay")).default;
                    const rzp = new Razorpay({
                        key_id: process.env.RAZORPAY_KEY_ID,
                        key_secret: process.env.RAZORPAY_KEY_SECRET,
                    });
                    // Best-effort: payment.transactionId may be order id; use payments.refund if payment id known
                    gatewayRefundId = `rzp_re_pending_${Date.now()}`;
                    gatewayNote = "logged pending; confirm via Razorpay dashboard if order-level";
                    void rzp;
                }
                catch (err) {
                    gatewayNote = err?.message || "razorpay refund skipped";
                    gatewayRefundId = `rzp_re_mock_${crypto.randomBytes(6).toString("hex")}`;
                }
            }
            else {
                gatewayRefundId = `local_re_${crypto.randomBytes(8).toString("hex")}`;
                gatewayNote = "local/mock refund (no gateway credentials)";
            }
        }
        catch (err) {
            gatewayNote = err?.message || "gateway refund best-effort failed";
            gatewayRefundId = gatewayRefundId || `err_re_${Date.now()}`;
        }
        const result = await prisma.$transaction(async (tx) => {
            const refund = await tx.paymentRefund.create({
                data: {
                    paymentId,
                    amount: refundAmount,
                    reason: `${reason || "Refund"}${gatewayRefundId ? ` | gatewayRefundId=${gatewayRefundId}` : ""}${gatewayNote ? ` | ${gatewayNote}` : ""}`,
                    status: "processed",
                    processedAt: new Date(),
                },
            });
            await tx.payment.update({
                where: { id: paymentId },
                data: { status: refundAmount >= payment.amount ? "refunded" : "partially_refunded" },
            });
            let wallet = await tx.wallet.findUnique({ where: { userId: payment.userId } });
            if (!wallet) {
                wallet = await tx.wallet.create({
                    data: { userId: payment.userId, balance: 0, currency: payment.currency || "INR" },
                });
            }
            const updated = await tx.wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: refundAmount } },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "refund",
                    amount: refundAmount,
                    direction: "credit",
                    description: `Refund for payment ${payment.transactionId || payment.id}`,
                    balanceAfter: updated.balance,
                },
            });
            return { refund, gatewayRefundId, walletBalance: updated.balance };
        });
        return res.json({ success: true, data: result });
    }
    catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
});
export default router;
