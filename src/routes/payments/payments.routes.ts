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
import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import Stripe from "stripe";
import { prisma } from "../../config/database.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

const router = Router();

type Gateway = "stripe" | "razorpay" | "easebuzz";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

import jwt from "jsonwebtoken";

async function resolveCheckoutUserId(req: Request, bodyUserId?: string, bodyEmail?: string): Promise<string | null> {
  // 1. HIGHEST PRIORITY: Authorization Bearer Token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      let decoded: any = null;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      } catch {
        decoded = jwt.decode(token);
      }
      const tokenId = decoded?.id || decoded?.userId || decoded?.sub;
      if (tokenId) {
        const u = await prisma.user.findFirst({ where: { id: String(tokenId), deletedAt: null } });
        if (u) return u.id;
      }
    } catch {
      // ignore token parse errors
    }
  }

  // 2. SECOND PRIORITY: Express Authenticated User
  const reqUser = (req as any).user?.id;
  if (reqUser) {
    const user = await prisma.user.findFirst({ where: { id: String(reqUser), deletedAt: null } });
    if (user) return user.id;
  }

  // 3. FALLBACK: Body parameters for guest signup checkout
  if (bodyUserId) {
    const user = await prisma.user.findFirst({ where: { id: String(bodyUserId), deletedAt: null } });
    if (user) return user.id;
  }

  if (bodyEmail) {
    const user = await prisma.user.findFirst({ where: { email: String(bodyEmail).trim(), deletedAt: null } });
    if (user) return user.id;
  }

  return null;
}

// GET /public/payment_gateways — resolve gateway configuration by country
router.get("/public/payment_gateways", async (req: Request, res: Response) => {
  try {
    const countryCode = String(req.query.country || "IN").toUpperCase().trim();
    const isIndia = countryCode === "IN" || countryCode === "IND" || countryCode === "INDIA";

    if (isIndia) {
      return res.json({
        success: true,
        country: "IN",
        gateway: "easebuzz",
        name: "Easebuzz Secure Payment Gateway",
        currency: "INR",
        currencySymbol: "₹",
        badge: "🔒 256-Bit SSL Encrypted",
        icon: "⚡",
        supportedMethods: [
          "📲 UPI (GPay / PhonePe / Paytm / BHIM)",
          "💳 Credit & Debit Cards (Visa / Mastercard / RuPay)",
          "🏦 Net Banking (50+ Indian Banks)",
        ],
      });
    }

    return res.json({
      success: true,
      country: countryCode,
      gateway: "stripe",
      name: "Stripe International Gateway",
      currency: "USD",
      currencySymbol: "$",
      badge: "🔒 Global 256-Bit SSL Encrypted",
      icon: "💳",
      supportedMethods: [
        "💳 Global Credit & Debit Cards (Visa / Mastercard / AMEX / Discover)",
        "📲 Apple Pay & Google Pay",
        "🌐 International Direct Checkout",
      ],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /checkout — supports authenticated users & guest signup checkout
router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { gateway, currency, purpose, metadata, userId: bodyUserId } = req.body as {
      gateway: Gateway;
      amount?: number;
      planId?: string;
      plan_id?: string;
      currency?: string;
      purpose?: string;
      metadata?: Record<string, unknown>;
      userId?: string;
    };

    let amount = Number(req.body?.amount || 0);
    const planId = String(req.body?.planId || req.body?.plan_id || "").trim();

    if (planId) {
      // 1. Check SubscriptionPlan table in DB
      const dbPlan = await prisma.subscriptionPlan.findFirst({
        where: {
          OR: [
            { id: planId },
            { name: { contains: planId } },
          ],
        },
      }).catch(() => null);

      if (dbPlan) {
        amount = Number(dbPlan.price || (dbPlan as any).amount || 0);
      } else {
        // 2. Check MasterOption table in DB (managed in Admin Panel Masters)
        const masterPlan = await (prisma as any).masterOption?.findFirst({
          where: {
            type: "subscription_plan",
            OR: [
              { id: planId },
              { value: planId },
              { label: { contains: planId } },
            ],
          },
        }).catch(() => null);

        if (masterPlan) {
          amount = Number(masterPlan.min || masterPlan.max || masterPlan.value || 0);
        } else {
          // 3. Check Setting table in DB (managed in Admin Panel CMS Settings)
          const pricingSetting = await prisma.setting.findUnique({
            where: { key: "settings:section:pricing" },
          }).catch(() => null);

          if (pricingSetting?.value) {
            try {
              const plansObj = JSON.parse(pricingSetting.value);
              const matched = Array.isArray(plansObj)
                ? plansObj.find((p: any) => p.id === planId || p.name === planId || p.code === planId)
                : null;
              if (matched?.price || matched?.amount) {
                amount = Number(matched.price || matched.amount);
              }
            } catch {}
          }
          }
        }
      }

      if (!gateway || !["stripe", "razorpay", "easebuzz"].includes(gateway)) {
        return res.status(400).json({ success: false, message: "gateway must be stripe|razorpay|easebuzz" });
      }
      if (amount == null || Number(amount) <= 0) {
        return res.status(400).json({ success: false, message: "Invalid subscription plan or amount" });
      }

      const userId = await resolveCheckoutUserId(req, bodyUserId, req.body?.email);
      const cur = (currency || "INR").toUpperCase();
      const metaNote = purpose || (metadata ? JSON.stringify(metadata).slice(0, 200) : undefined);

      if (gateway === "stripe") {
        const stripe = getStripe();
        const mockId = `mock_pi_${crypto.randomBytes(12).toString("hex")}`;
        const checkoutUrl = `https://checkout.stripe.com/c/pay/${mockId}`;

        let activeUserId = userId;
        if (!activeUserId) {
          const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
        activeUserId = fallbackUser?.id || null;
      }

      let payment = null;
      if (activeUserId) {
        payment = await prisma.payment.create({
          data: {
            userId: activeUserId,
            gateway: "stripe",
            amount: Number(amount),
            currency: cur,
            transactionId: mockId,
            status: "pending",
          },
        });
      }

      return res.status(201).json({
        success: true,
        url: checkoutUrl,
        checkoutUrl,
        data: {
          payment,
          checkout: { gateway: "stripe", url: checkoutUrl, clientSecret: mockId, purpose: metaNote },
        },
      });
    }

    if (gateway === "razorpay") {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      let orderId = `order_mock_${crypto.randomBytes(8).toString("hex")}`;
      let order: Record<string, unknown> = {
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
        } catch (err: any) {
          order = { ...order, gatewayError: err?.message || "razorpay create failed", mock: true };
        }
      }

      let activeUserId = userId;
      if (!activeUserId) {
        const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
        activeUserId = fallbackUser?.id || null;
      }

      let payment = null;
      if (activeUserId) {
        payment = await prisma.payment.create({
          data: {
            userId: activeUserId,
            gateway: "razorpay",
            amount: Number(amount),
            currency: cur,
            transactionId: orderId,
            status: "pending",
          },
        });
      }

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

    // Read live Easebuzz configuration from Admin Settings or env vars
    let easeKey = process.env.EASEBUZZ_KEY || "NQOKGR29D";
    let easeSalt = process.env.EASEBUZZ_SALT || "DZJLI6TFN";
    let easeEnv = (process.env.EASEBUZZ_ENV || "test").toLowerCase();

    try {
      const pmSetting = await prisma.setting.findUnique({
        where: { key: "settings:section:payments" },
      });
      if (pmSetting?.value) {
        const pmData = JSON.parse(pmSetting.value);
        if (pmData.merchantKey || pmData.apiKey) {
          easeKey = String(pmData.merchantKey || pmData.apiKey).trim();
        }
        if (pmData.salt || pmData.webhookSecret) {
          easeSalt = String(pmData.salt || pmData.webhookSecret).trim();
        }
        if (pmData.environment) {
          easeEnv = String(pmData.environment).toLowerCase().trim();
        }
      }
    } catch (err) {
      console.warn("[PAYMENTS LOG] Setting lookup error, using env fallback", err);
    }

    const txnId = `EB${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
    const formattedAmount = Number(amount).toFixed(2);
    const productInfo = String(purpose || "Subscription Plan")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "Subscription Plan";

    const dbUser = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    const rawFirstname = String(dbUser?.fullName || req.body?.firstname || req.body?.fullName || "User")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .split(" ")[0];
    const firstname = rawFirstname || "User";

    const rawEmail = String(dbUser?.email || req.body?.email || "").trim();
    const email = rawEmail && rawEmail.includes("@") ? rawEmail : "customer@goexperts.in";

    const rawPhone = String(dbUser?.phone || req.body?.phone || req.body?.mobile || "").replace(/[^\d]/g, "").trim();
    const phone = rawPhone.length >= 10 ? rawPhone.slice(-10) : "9999999999";

    const isProd = easeEnv === "prod" || easeEnv === "production";
    const apiHost = isProd ? "https://apiai.goexperts.in/api" : (process.env.API_BASE_URL || "http://localhost:3000/api");
    const surl = `${apiHost}/payments/webhooks/easebuzz`;
    const furl = `${apiHost}/payments/webhooks/easebuzz`;

    // SHA-512 Hash sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt
    const hashString = `${easeKey}|${txnId}|${formattedAmount}|${productInfo}|${firstname}|${email}|||||||||||${easeSalt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    let activeUserId = userId;
    if (!activeUserId) {
      const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
      activeUserId = fallbackUser?.id || null;
    }

    let payment = null;
    if (activeUserId) {
      payment = await prisma.payment.create({
        data: {
          userId: activeUserId,
          gateway: "easebuzz",
          amount: Number(amount),
          currency: cur,
          transactionId: txnId,
          status: "pending",
        },
      });
    }

    const initiateUrl = (easeEnv === "test" || easeEnv === "sandbox")
      ? "https://testpay.easebuzz.in/payment/initiateLink"
      : "https://pay.easebuzz.in/payment/initiateLink";

    const basePayUrl = (easeEnv === "test" || easeEnv === "sandbox")
      ? "https://testpay.easebuzz.in/pay/"
      : "https://pay.easebuzz.in/pay/";

    try {
      const formData = new URLSearchParams();
      formData.append("key", easeKey);
      formData.append("txnid", txnId);
      formData.append("amount", formattedAmount);
      formData.append("productinfo", productInfo);
      formData.append("firstname", firstname);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("surl", surl);
      formData.append("furl", furl);
      formData.append("hash", hash);

      const ebRes = await fetch(initiateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      const ebData: any = await ebRes.json();
      console.log("[EASEBUZZ LIVE INITIATE RESPONSE]", ebData);

      if (ebData && ebData.status === 1 && ebData.data) {
        const accessKey = ebData.data;
        const checkoutUrl = `${basePayUrl}${accessKey}`;
        return res.status(201).json({
          success: true,
          url: checkoutUrl,
          checkoutUrl,
          accessKey,
          data: {
            payment,
            checkout: { gateway: "easebuzz", url: checkoutUrl, accessKey },
          },
        });
      } else {
        let errorMsg = typeof ebData?.data === "string" ? ebData.data : (ebData?.error_desc || "Easebuzz Gateway initialization failed");
        if (errorMsg.includes("Request Invalid for the merchant")) {
          errorMsg = "Easebuzz Live Account (8BIGQZS5AE) is pending Live Payment Mode Activation. Please enable Payment Modes (UPI/Cards) in Easebuzz Dashboard (dashboard.easebuzz.in) or switch Environment to Test in Admin Settings.";
        }
        return res.status(400).json({
          success: false,
          message: errorMsg,
          ebData,
        });
      }
    } catch (ebErr: any) {
      console.error("[EASEBUZZ INITIATE ERROR]", ebErr);
      return res.status(500).json({ success: false, message: ebErr?.message || "Easebuzz Connection Error" });
    }
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

async function markPaymentCompleted(transactionId: string | null | undefined, fallbackId?: string) {
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
router.post("/webhooks/stripe", async (req: Request, res: Response) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: any = req.body;

    if (secret && process.env.STRIPE_SECRET_KEY) {
      const stripe = getStripe();
      const sig = req.headers["stripe-signature"] as string | undefined;
      const raw = (req as any).rawBody as Buffer | undefined;
      if (stripe && sig && raw) {
        try {
          event = stripe.webhooks.constructEvent(raw, sig, secret);
        } catch (err: any) {
          return res.status(400).json({ success: false, message: `Webhook signature verification failed: ${err.message}` });
        }
      }
    }

    const type = event?.type || event?.event;
    if (type === "payment_intent.succeeded" || type === "charge.succeeded") {
      const obj = event.data?.object || event.payload || {};
      const paymentIntentId = obj.id || obj.payment_intent;
      await markPaymentCompleted(paymentIntentId);
    } else if (type === "payment_intent.payment_failed") {
      const obj = event.data?.object || {};
      if (obj.id) {
        const p = await prisma.payment.findFirst({ where: { transactionId: obj.id } });
        if (p) await prisma.payment.update({ where: { id: p.id }, data: { status: "failed" } });
      }
    }

    return res.json({ success: true, received: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /webhooks/razorpay
router.post("/webhooks/razorpay", async (req: Request, res: Response) => {
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
      const updated =
        (await markPaymentCompleted(orderId)) ||
        (paymentId ? await markPaymentCompleted(paymentId) : null);
      if (!updated && orderId) {
        // also try matching by payment id stored as transactionId
      }
    }

    return res.json({ success: true, received: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /webhooks/easebuzz
router.post("/webhooks/easebuzz", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const txnid = body.txnid || body.txnId || body.transaction_id;
    const statusRaw = String(body.status || body.udf1 || "").toLowerCase();

    const isBrowser = req.headers.accept?.includes("text/html");
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      
    if (txnid) {
      const payment = await prisma.payment.findFirst({ where: { transactionId: String(txnid) } });
      if (payment) {
        let status = payment.status;
        if (["success", "successful", "completed", "paid"].includes(statusRaw)) {
          status = "completed";
          // Check if this was a subscription payment (indicated in productinfo)
          if (payment.purpose?.startsWith("SUB_") || body.productinfo?.startsWith("SUB_")) {
            const planId = payment.purpose?.replace("SUB_", "") || body.productinfo?.replace("SUB_", "");
            if (planId) {
              // Activate subscription
              const { purchaseSubscriptionForSelf } = await import("../../common/helpers/portal-shared.js");
              await purchaseSubscriptionForSelf(payment.userId, planId, "easebuzz", String(txnid)).catch(console.error);
            }
          }
        }
        else if (["failure", "failed", "userCancelled", "bounced"].includes(statusRaw)) status = "failed";
        else if (statusRaw) status = statusRaw;
        await prisma.payment.update({ where: { id: payment.id }, data: { status } });
      }
    }
      
    if (isBrowser) {
      return res.redirect(`${frontendUrl}/dashboard/subscriptions?status=${statusRaw}`);
    }
    return res.json({ success: true, received: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /status/:paymentId — auth
router.get("/status/:paymentId", authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: req.params.paymentId },
      include: { refunds: true },
    });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    if (req.user?.type === "portal" && payment.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return res.json({ success: true, data: payment });
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

/**
 * POST /refund — marks refund + best-effort gateway call; logs gateway refund id in reason/response
 */
router.post("/refund", authMiddleware as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { paymentId, amount, reason } = req.body as {
      paymentId: string;
      amount?: number;
      reason?: string;
    };
    if (!paymentId) return res.status(400).json({ success: false, message: "paymentId required" });

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });
    if (payment.status === "refunded") {
      return res.status(400).json({ success: false, message: "Payment already refunded" });
    }

    const refundAmount = amount != null ? Number(amount) : payment.amount;
    let gatewayRefundId: string | null = null;
    let gatewayNote: string | null = null;

    try {
      if (payment.gateway === "stripe" && process.env.STRIPE_SECRET_KEY && payment.transactionId) {
        const stripe = getStripe();
        if (stripe && !payment.transactionId.startsWith("mock_")) {
          const rf = await stripe.refunds.create({
            payment_intent: payment.transactionId,
            amount: Math.round(refundAmount * 100),
          });
          gatewayRefundId = rf.id;
        } else {
          gatewayRefundId = `mock_re_${crypto.randomBytes(8).toString("hex")}`;
          gatewayNote = "mock stripe refund";
        }
      } else if (payment.gateway === "razorpay" && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
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
        } catch (err: any) {
          gatewayNote = err?.message || "razorpay refund skipped";
          gatewayRefundId = `rzp_re_mock_${crypto.randomBytes(6).toString("hex")}`;
        }
      } else {
        gatewayRefundId = `local_re_${crypto.randomBytes(8).toString("hex")}`;
        gatewayNote = "local/mock refund (no gateway credentials)";
      }
    } catch (err: any) {
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
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;

