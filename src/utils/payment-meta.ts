import { prisma } from '../config/db.js';

const keyFor = (paymentId: string) => `payment_meta:${paymentId}`;

export const storePaymentMeta = async (
  paymentId: string,
  meta: Record<string, unknown>
) => {
  const key = keyFor(paymentId);
  const value = JSON.stringify(meta);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value, category: 'payments' },
    update: { value },
  });
};

export const loadPaymentMeta = async (
  paymentId: string
): Promise<Record<string, unknown> | null> => {
  const row = await prisma.setting.findUnique({ where: { key: keyFor(paymentId) } });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as Record<string, unknown>;
  } catch {
    return null;
  }
};
