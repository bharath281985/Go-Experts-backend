import { successResponse, errorResponse } from '../../../core/response.js';
import { initiatePaymentService, verifyPaymentService, completePaymentFromWebhook, } from './payments.service.js';
import { prisma } from '../../../config/database.js';
import { verifyEasebuzzReverseHash } from './gateways/easebuzz.gateway.js';
import { listPublicGateways } from '../../../utils/payment-gateways.js';
export const getGateways = async (_req, res, next) => {
    try {
        const gateways = listPublicGateways();
        return res.json(successResponse('Gateways retrieved', gateways));
    }
    catch (error) {
        next(error);
    }
};
export const initiatePayment = async (req, res, next) => {
    try {
        const { gateway, purpose, amount, currency, planId, invoiceId, metadata } = req.body;
        if (!gateway || !amount) {
            return res.status(422).json(errorResponse('gateway and amount are required', 'VALIDATION_ERROR'));
        }
        const payment = await initiatePaymentService(req.user.id, gateway, Number(amount), currency || 'INR', { purpose, planId, invoiceId, billingCycle: metadata?.billingCycle, ...(metadata || {}) });
        return res.json(successResponse('Payment initiated', payment));
    }
    catch (error) {
        if (error.message === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
            return res.status(400).json(errorResponse('Payment gateway is not configured', 'PAYMENT_GATEWAY_NOT_CONFIGURED'));
        }
        if (error.message === 'PAYMENT_GATEWAY_DISABLED') {
            return res.status(400).json(errorResponse('Payment gateway is disabled', 'PAYMENT_GATEWAY_DISABLED'));
        }
        if (error.message === 'INVALID_GATEWAY') {
            return res.status(400).json(errorResponse('Invalid payment gateway', 'INVALID_GATEWAY'));
        }
        next(error);
    }
};
export const verifyPayment = async (req, res, next) => {
    try {
        const { paymentId, gateway, purpose, planId, ...verification } = req.body;
        if (!paymentId || !gateway) {
            return res.status(422).json(errorResponse('paymentId and gateway are required', 'VALIDATION_ERROR'));
        }
        const result = await verifyPaymentService(req.user.id, paymentId, gateway, {
            ...verification,
            purpose,
            planId,
        });
        return res.json(successResponse('Payment verified', result));
    }
    catch (error) {
        if (error.message === 'PAYMENT_NOT_FOUND') {
            return res.status(404).json(errorResponse('Payment not found', 'NOT_FOUND'));
        }
        if (error.message === 'PAYMENT_GATEWAY_DISABLED') {
            return res.status(400).json(errorResponse('Payment gateway is disabled', 'PAYMENT_GATEWAY_DISABLED'));
        }
        next(error);
    }
};
export const getHistory = async (req, res, next) => {
    try {
        const history = await prisma.payment.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.json(successResponse('Payment history retrieved', history));
    }
    catch (error) {
        next(error);
    }
};
export const getPayment = async (req, res, next) => {
    try {
        const payment = await prisma.payment.findFirst({
            where: { id: req.params.id, userId: req.user.id },
        });
        if (!payment)
            return res.status(404).json(errorResponse('Payment not found', 'NOT_FOUND'));
        return res.json(successResponse('Payment details retrieved', payment));
    }
    catch (error) {
        next(error);
    }
};
export const easebuzzWebhook = async (req, res) => {
    try {
        const { txnid, amount, status, hash, email, firstname, productinfo } = req.body;
        const valid = verifyEasebuzzReverseHash(String(txnid || ''), String(amount || ''), String(status || ''), String(hash || ''), String(email || ''), String(firstname || ''), String(productinfo || ''));
        if (valid && String(status).toLowerCase() === 'success') {
            await completePaymentFromWebhook(String(txnid), String(productinfo || ''));
        }
        res.json({ status: 'ok' });
    }
    catch {
        res.json({ status: 'ok' });
    }
};
export const razorpayWebhook = async (_req, res) => {
    res.json({ status: 'ok' });
};
export const stripeWebhook = async (_req, res) => {
    res.json({ status: 'ok' });
};
