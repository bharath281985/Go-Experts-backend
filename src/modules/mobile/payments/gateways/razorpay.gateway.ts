export const initiateRazorpayPayment = async (amount: number, currency: string, metadata: any) => {
  if (!process.env.RAZORPAY_KEY_ID) throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');
  return {
    paymentId: `rzp_${Date.now()}`,
    gateway: 'razorpay',
    amount,
    currency,
    paymentUrl: 'https://api.razorpay.com/v1/checkout/mock',
    orderId: `order_${Date.now()}`,
    gatewayPayload: {}
  };
};
