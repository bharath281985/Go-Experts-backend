import { prisma } from '../../../config/database.js';
import { initiateEasebuzzPayment, verifyEasebuzzReverseHash } from './gateways/easebuzz.gateway.js';
import { initiateRazorpayPayment } from './gateways/razorpay.gateway.js';
import { initiateStripePayment } from './gateways/stripe.gateway.js';
import { activateUserSubscription } from '../../../services/mobile/subscription.service.js';
import {
  assertGatewayAllowed,
  buildProductInfo,
  parseProductInfo,
} from '../../../utils/payment-gateways.js';
import { loadPaymentMeta, storePaymentMeta } from '../../../utils/payment-meta.js';

export const initiatePaymentService = async (
  userId: string,
  gateway: string,
  amount: number,
  currency: string,
  metadata: Record<string, unknown> = {}
) => {
  const allowedGateway = assertGatewayAllowed(gateway);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const productinfo = buildProductInfo(metadata);
  const enriched = {
    ...metadata,
    productinfo,
    purpose: metadata.purpose || productinfo,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone || undefined,
  };

  const paymentRecord = await prisma.payment.create({
    data: {
      userId,
      gateway: allowedGateway,
      amount,
      currency: currency || 'INR',
      status: 'pending',
    },
  });

  await storePaymentMeta(paymentRecord.id, {
    purpose: metadata.purpose,
    planId: metadata.planId,
    billingCycle: metadata.billingCycle,
    invoiceId: metadata.invoiceId,
    productinfo,
  });

  let gatewayResult;
  switch (allowedGateway) {
    case 'easebuzz':
      gatewayResult = await initiateEasebuzzPayment(amount, currency, enriched);
      break;
    case 'razorpay':
      gatewayResult = await initiateRazorpayPayment(amount, currency, enriched);
      break;
    case 'stripe':
      gatewayResult = await initiateStripePayment(amount, currency, enriched);
      break;
    default:
      throw new Error('INVALID_GATEWAY');
  }

  await prisma.payment.update({
    where: { id: paymentRecord.id },
    data: { transactionId: gatewayResult.orderId },
  });

  return {
    paymentId: paymentRecord.id,
    gateway: gatewayResult.gateway,
    paymentUrl: gatewayResult.paymentUrl,
    orderId: gatewayResult.orderId,
    gatewayPayload: gatewayResult.gatewayPayload,
  };
};

export const verifyPaymentService = async (
  userId: string,
  paymentId: string,
  gateway: string,
  verification: Record<string, unknown>
) => {
  assertGatewayAllowed(gateway);

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  if (payment.status === 'completed') {
    return { status: 'success', paymentId: payment.id, alreadyCompleted: true };
  }

  let verified = false;
  const meta = (await loadPaymentMeta(paymentId)) || {};

  if (gateway === 'easebuzz') {
    const txnid = String(verification.txnid || verification.orderId || payment.transactionId || '');
    const amount = String(verification.amount || payment.amount.toFixed(2));
    const status = String(verification.status || 'success');
    const hash = String(verification.hash || '');
    const email = String(verification.email || '');
    const firstname = String(verification.firstname || '');
    const productinfo = String(
      verification.productinfo || meta.productinfo || ''
    );

    if (hash) {
      verified = verifyEasebuzzReverseHash(
        txnid,
        amount,
        status,
        hash,
        email,
        firstname,
        productinfo
      );
    } else if (process.env.EASEBUZZ_ENV === 'live') {
      // Production: never activate on Flutter status alone without reverse hash.
      verified = false;
    } else {
      // Test env only — accept success status when SDK omits hash.
      verified = status === 'success' || status === 'Success';
    }
  } else if (gateway === 'razorpay' || gateway === 'stripe') {
    verified = verification.status === 'success' || verification.verified === true;
  }

  if (!verified) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
    return { status: 'failed', paymentId: payment.id };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'completed' },
  });

  const purpose = String(verification.purpose || meta.purpose || '');
  const planId = String(verification.planId || meta.planId || '');
  if (purpose === 'subscription' && planId) {
    const billingCycle =
      String(verification.billingCycle || meta.billingCycle || 'monthly').toLowerCase() ===
      'yearly'
        ? 'yearly'
        : 'monthly';
    await activateUserSubscription(userId, planId, billingCycle);
  }

  return { status: 'success', paymentId: payment.id };
};

/** Complete payment from trusted webhook (hash already verified). */
export const completePaymentFromWebhook = async (
  txnid: string,
  productinfo: string
) => {
  const payment = await prisma.payment.findFirst({
    where: { transactionId: txnid },
  });
  if (!payment) return null;
  if (payment.status === 'completed') return payment;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'completed' },
  });

  const meta = (await loadPaymentMeta(payment.id)) || {};
  const parsed = parseProductInfo(productinfo || String(meta.productinfo || ''));
  const purpose = String(meta.purpose || parsed.purpose || '');
  const planId = String(meta.planId || parsed.planId || '');
  if (purpose === 'subscription' && planId) {
    await activateUserSubscription(
      payment.userId,
      planId,
      parsed.billingCycle ||
        (String(meta.billingCycle || 'monthly').toLowerCase() === 'yearly'
          ? 'yearly'
          : 'monthly')
    );
  }
  return payment;
};
