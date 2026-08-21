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

export const initiateEasebuzzPayment = async (
  amount: number,
  currency: string,
  metadata: Record<string, unknown> = {}
): Promise<EasebuzzInitiateResult> => {
  let key = process.env.EASEBUZZ_KEY || '8BIGQZS5AE';
  let salt = process.env.EASEBUZZ_SALT || '5D9UII20TB';
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
    console.warn('[EASEBUZZ MOBILE] Setting lookup warning, using defaults/env', err);
  }

  const txnid = `EB${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const productinfo = String(
    metadata.productinfo || metadata.purpose || metadata.planId || 'GoExperts Payment'
  );
  const firstname = String(metadata.firstname || metadata.fullName || 'GoExperts User');
  const email = String(metadata.email || 'user@goexperts.in');
  const phone = String(metadata.phone || '9999999999');
  const surl = String(metadata.successUrl || process.env.EASEBUZZ_SUCCESS_URL || 'https://goexperts.in/payment/success');
  const furl = String(metadata.failureUrl || process.env.EASEBUZZ_FAILURE_URL || 'https://goexperts.in/payment/failure');

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

  const baseUrl = easeEnv === 'live' ? 'https://pay.easebuzz.in' : 'https://testpay.easebuzz.in';
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
  const key = process.env.EASEBUZZ_KEY || '8BIGQZS5AE';
  const salt = process.env.EASEBUZZ_SALT || '5D9UII20TB';

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
