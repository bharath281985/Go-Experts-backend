import Stripe from 'stripe';

export const initiateStripePayment = async (amount: number, currency: string, metadata: any) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');

  const stripe = new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: (currency || 'INR').toLowerCase(),
          product_data: {
            name: String(metadata?.purpose || metadata?.productinfo || 'GoExperts Payment'),
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    customer_email: metadata?.email ? String(metadata.email) : undefined,
    success_url: String(metadata?.successUrl || process.env.STRIPE_SUCCESS_URL || 'https://goexperts.in/payment/success'),
    cancel_url: String(metadata?.failureUrl || process.env.STRIPE_CANCEL_URL || 'https://goexperts.in/payment/failure'),
    metadata: {
      purpose: String(metadata?.purpose || ''),
      planId: String(metadata?.planId || ''),
    },
  });

  return {
    paymentId: String(session.id),
    gateway: 'stripe',
    amount,
    currency,
    paymentUrl: session.url || '',
    orderId: String(session.id),
    gatewayPayload: {
      sessionId: session.id,
    },
  };
};
