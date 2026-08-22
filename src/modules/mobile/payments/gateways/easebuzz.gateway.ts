import crypto from 'crypto';
import { prisma } from '../../../../config/database.js';

export interface EasebuzzInitiateResult {
  paymentId: string;
  gateway: 'easebuzz';
  amount: number;
  currency: string;
  paymentUrl: string;
  orderId: string;
  gatewayPayload: Record<string, unknown>;
}

export const generateEasebuzzHash = (parts: string[]) =>
  crypto.createHash('sha512').update(parts.join('|')).digest('hex');

const cleanEasebuzzText = (value: unknown, fallback: string, maxLength: number) => {
  const cleaned = String(value || fallback)
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
};

const cleanEasebuzzEmail = (value: unknown) => {
  const email = String(value || '').trim();
  if (!email || !email.includes('@')) {
    throw new Error('USER_EMAIL_REQUIRED_FOR_PAYMENT');
  }
  return email;
};

const cleanEasebuzzPhone = (value: unknown) => {
  const phone = String(value || '').replace(/[^\d]/g, '').trim();
  if (phone.length < 10) {
    throw new Error('USER_PHONE_REQUIRED_FOR_PAYMENT');
  }
  return phone.slice(-10);
};

const cleanEasebuzzFirstName = (value: unknown) => {
  const firstname = cleanEasebuzzText(String(value || '').split(' ')[0], '', 50);
  if (!firstname) {
    throw new Error('USER_NAME_REQUIRED_FOR_PAYMENT');
  }
  return firstname;
};

export const initiateEasebuzzPayment = async (
  amount: number,
  currency: string,
  metadata: Record<string, unknown> = {}
): Promise<EasebuzzInitiateResult> => {
  let key = process.env.EASEBUZZ_KEY || '';
  let salt = process.env.EASEBUZZ_SALT || '';
  let easeEnv = (process.env.EASEBUZZ_ENV || 'live').toLowerCase();

  try {
    const pmSetting = await prisma.setting.findUnique({
      where: { key: 'settings:section:payments' },
    });
    if (pmSetting?.value) {
      const pmData = JSON.parse(pmSetting.value);
      if (pmData.merchantKey || pmData.apiKey) {
        key = String(pmData.merchantKey || pmData.apiKey).trim();
      }
      if (pmData.salt || pmData.webhookSecret) {
        salt = String(pmData.salt || pmData.webhookSecret).trim();
      }
      if (pmData.environment) {
        easeEnv = String(pmData.environment).toLowerCase().trim();
      }
    }
  } catch (err) {
    console.warn('[EASEBUZZ MOBILE] Setting lookup warning, using env config only', err);
  }

  if (!key || !salt) {
    throw new Error('EASEBUZZ_GATEWAY_NOT_CONFIGURED');
  }

  const txnid = `EB${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const productinfo = cleanEasebuzzText(
    metadata.productinfo || metadata.purpose || metadata.planId,
    'GoExperts Payment',
    80
  );
  const firstname = cleanEasebuzzFirstName(metadata.firstname || metadata.fullName);
  const email = cleanEasebuzzEmail(metadata.email);
  const phone = cleanEasebuzzPhone(metadata.phone);
  const isProd = easeEnv === 'live' || easeEnv === 'prod' || easeEnv === 'production';
  const apiHost = isProd
    ? 'https://apiai.goexperts.in/api'
    : process.env.API_BASE_URL || 'http://localhost:3000/api';
  const surl = String(metadata.successUrl || process.env.EASEBUZZ_SUCCESS_URL || `${apiHost}/payments/webhooks/easebuzz`);
  const furl = String(metadata.failureUrl || process.env.EASEBUZZ_FAILURE_URL || `${apiHost}/payments/webhooks/easebuzz`);

  const hash = generateEasebuzzHash([
    key,
    txnid,
    amount.toFixed(2),
    productinfo,
    firstname,
    email,
    '', '', '', '', '', '', '', '', '', '',
    salt,
  ]);

  const body = new URLSearchParams({
    key,
    txnid,
    amount: amount.toFixed(2),
    productinfo,
    firstname,
    email,
    phone,
    surl,
    furl,
    hash,
  });

  const baseUrl = isProd ? 'https://pay.easebuzz.in' : 'https://testpay.easebuzz.in';
  const response = await fetch(`${baseUrl}/payment/initiateLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const result = (await response.json()) as { status?: number; data?: string; error_desc?: string };
  if (result.status !== 1 || !result.data) {
    const errorMsg = typeof result.data === 'string' ? result.data : (result.error_desc || 'EASEBUZZ_INITIATE_FAILED');
    throw new Error(errorMsg);
  }

  return {
    paymentId: txnid,
    gateway: 'easebuzz',
    amount,
    currency,
    paymentUrl: `${baseUrl}/pay/${result.data}`,
    orderId: txnid,
    gatewayPayload: {
      accessKey: result.data,
      txnid,
      payMode: easeEnv === 'live' ? 'production' : 'test',
    },
  };
};

/** Reverse hash verification for Easebuzz callback/status. */
export const verifyEasebuzzReverseHash = (
  txnid: string,
  amount: string,
  status: string,
  receivedHash: string,
  email = '',
  firstname = '',
  productinfo = ''
): boolean => {
  const key = process.env.EASEBUZZ_KEY || '';
  const salt = process.env.EASEBUZZ_SALT || '';
  if (!key || !salt) return false;

  const expected = generateEasebuzzHash([
    salt,
    status,
    '', '', '', '', '', '', '', '', '', '', '',
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key,
  ]);

  return receivedHash === expected;
};
