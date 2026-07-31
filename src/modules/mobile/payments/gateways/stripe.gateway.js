export const initiateStripePayment = async (amount, currency, metadata) => {
    if (!process.env.STRIPE_SECRET_KEY)
        throw new Error('PAYMENT_GATEWAY_NOT_CONFIGURED');
    return {
        paymentId: `pi_${Date.now()}`,
        gateway: 'stripe',
        amount,
        currency,
        paymentUrl: 'https://checkout.stripe.com/pay/mock',
        orderId: `order_${Date.now()}`,
        gatewayPayload: {}
    };
};
