import Razorpay from 'razorpay';

export const initiateRazorpayPayment = async (amount: number, currency: string, metadata: any) => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: currency || 'INR',
    receipt: `rcpt_${Date.now()}`,
    notes: {
      purpose: String(metadata?.purpose || ''),
      userId: String(metadata?.userId || ''),
      planId: String(metadata?.planId || ''),
    },
  });

  return {
    paymentId: String(order.id),
    gateway: 'razorpay',
    amount,
    currency,
    paymentUrl: '',
    orderId: String(order.id),
    gatewayPayload: {
      order,
      keyId,
    },
  };
};
