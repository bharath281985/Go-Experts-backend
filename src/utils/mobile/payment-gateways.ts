/** Feature-flagged payment gateways. Production default: Easebuzz only. */

const truthy = (v: string | undefined) =>
  ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());

export type GatewayCode = 'easebuzz' | 'razorpay' | 'stripe';

export const isGatewayEnabled = (code: GatewayCode): boolean => {
  switch (code) {
    case 'easebuzz':
      // Enabled whenever keys exist (or explicitly forced on for listing in staging).
      return !!(process.env.EASEBUZZ_KEY && process.env.EASEBUZZ_SALT);
    case 'razorpay':
      return truthy(process.env.ENABLE_RAZORPAY) && !!process.env.RAZORPAY_KEY_ID;
    case 'stripe':
      return truthy(process.env.ENABLE_STRIPE) && !!process.env.STRIPE_SECRET_KEY;
    default:
      return false;
  }
};

export const listPublicGateways = () => {
  const all: Array<{ code: GatewayCode; name: string; enabled: boolean }> = [
    { code: 'easebuzz', name: 'Easebuzz', enabled: isGatewayEnabled('easebuzz') },
    { code: 'razorpay', name: 'Razorpay', enabled: isGatewayEnabled('razorpay') },
    { code: 'stripe', name: 'Stripe', enabled: isGatewayEnabled('stripe') },
  ];
  // Production / default: only return enabled gateways (Easebuzz only unless flags set).
  return all.filter((g) => g.enabled);
};

export const assertGatewayAllowed = (gateway: string): GatewayCode => {
  if (!['easebuzz', 'razorpay', 'stripe'].includes(gateway)) {
    throw new Error('INVALID_GATEWAY');
  }
  if (!isGatewayEnabled(gateway as GatewayCode)) {
    throw new Error('PAYMENT_GATEWAY_DISABLED');
  }
  return gateway as GatewayCode;
};

/** Encode subscription intent into Easebuzz productinfo for webhook activation. */
export const buildProductInfo = (metadata: Record<string, unknown>): string => {
  const purpose = String(metadata.purpose || 'payment');
  if (purpose === 'subscription' && metadata.planId) {
    const cycle =
      String(metadata.billingCycle || 'monthly').toLowerCase() === 'yearly'
        ? 'yearly'
        : 'monthly';
    return `subscription|${metadata.planId}|${cycle}`;
  }
  return purpose.slice(0, 100);
};

export const parseProductInfo = (
  productinfo: string
): { purpose?: string; planId?: string; billingCycle?: 'monthly' | 'yearly' } => {
  const parts = String(productinfo || '').split('|');
  if (parts[0] === 'subscription' && parts[1]) {
    return {
      purpose: 'subscription',
      planId: parts[1],
      billingCycle: parts[2] === 'yearly' ? 'yearly' : 'monthly',
    };
  }
  return { purpose: productinfo };
};
