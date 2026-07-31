"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPaymentMeta = exports.storePaymentMeta = void 0;
const db_js_1 = require("../config/db.js");
const keyFor = (paymentId) => `payment_meta:${paymentId}`;
const storePaymentMeta = async (paymentId, meta) => {
    const key = keyFor(paymentId);
    const value = JSON.stringify(meta);
    await db_js_1.prisma.setting.upsert({
        where: { key },
        create: { key, value, category: 'payments' },
        update: { value },
    });
};
exports.storePaymentMeta = storePaymentMeta;
const loadPaymentMeta = async (paymentId) => {
    const row = await db_js_1.prisma.setting.findUnique({ where: { key: keyFor(paymentId) } });
    if (!row?.value)
        return null;
    try {
        return JSON.parse(row.value);
    }
    catch {
        return null;
    }
};
exports.loadPaymentMeta = loadPaymentMeta;
