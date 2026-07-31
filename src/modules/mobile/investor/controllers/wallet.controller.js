import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
export const getWallet = async (req, res, next) => {
    try {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        return res.json(successResponse('Wallet retrieved', wallet || { balance: 0, currency: 'USD' }));
    }
    catch (error) {
        next(error);
    }
};
export const getTransactions = async (req, res, next) => {
    try {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        if (!wallet)
            return res.json(successResponse('Transactions', []));
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [transactions, total] = await Promise.all([
            prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            prisma.walletTransaction.count({ where: { walletId: wallet.id } })
        ]);
        return res.json(successResponse('Transactions retrieved', transactions, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const requestWithdrawal = async (req, res, next) => {
    try {
        const { amount, method, bankDetails, upiDetails } = req.body;
        // Validate amount
        const parsedAmount = parseFloat(String(amount));
        if (!parsedAmount || parsedAmount <= 0) {
            return res.status(400).json(errorResponse('Withdrawal amount must be greater than 0', 'VALIDATION_ERROR'));
        }

        // Fetch wallet to check currency and balance
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        if (!wallet) {
            return res.status(404).json(errorResponse('Wallet not found', 'NOT_FOUND'));
        }

        const minAmount = wallet.currency === 'USD' ? 10 : 500;
        const currencySymbol = wallet.currency === 'USD' ? '$' : '₹';
        if (parsedAmount < minAmount) {
            return res.status(400).json(errorResponse(`Minimum withdrawal amount is ${currencySymbol}${minAmount}`, 'VALIDATION_ERROR'));
        }

        // Validate method
        if (!method || !['bank', 'upi'].includes(method)) {
            return res.status(400).json(errorResponse("Method must be 'bank' or 'upi'", 'VALIDATION_ERROR'));
        }

        // Validate method-specific details
        if (method === 'bank') {
            if (!bankDetails?.accountHolderName || !bankDetails?.accountNumber || !bankDetails?.ifscCode || !bankDetails?.bankName) {
                return res.status(400).json(errorResponse('Bank details are required: accountHolderName, accountNumber, ifscCode, bankName', 'VALIDATION_ERROR'));
            }
        }
        if (method === 'upi') {
            if (!upiDetails?.upiId) {
                return res.status(400).json(errorResponse('UPI ID is required', 'VALIDATION_ERROR'));
            }
        }

        // Check sufficient balance
        if (wallet.balance < parsedAmount) {
            return res.status(400).json(errorResponse(`Insufficient balance. Available: ${currencySymbol}${wallet.balance.toFixed(2)}`, 'INSUFFICIENT_BALANCE'));
        }

        // Deduct balance & create transaction atomically
        const newBalance = parseFloat((wallet.balance - parsedAmount).toFixed(2));
        const [updatedWallet, transaction] = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance },
            }),
            prisma.walletTransaction.create({
                data: {
                    id: randomUUID(),
                    walletId: wallet.id,
                    type: 'withdrawal',
                    amount: parsedAmount,
                    direction: 'debit',
                    description: method === 'bank'
                        ? `Bank withdrawal to ${bankDetails.bankName} ****${bankDetails.accountNumber.slice(-4)}`
                        : `UPI withdrawal to ${upiDetails.upiId}`,
                    balanceAfter: newBalance,
                    status: 'pending',
                },
            }),
        ]);

        // Build response payload
        const payoutInfo = method === 'bank'
            ? {
                method: 'bank',
                accountHolderName: bankDetails.accountHolderName,
                accountNumber: `****${bankDetails.accountNumber.slice(-4)}`,
                ifscCode: bankDetails.ifscCode,
                bankName: bankDetails.bankName,
            }
            : {
                method: 'upi',
                upiId: upiDetails.upiId,
            };

        return res.status(201).json(successResponse('Withdrawal request submitted successfully. Your amount will be credited within 48 hours.', {
            transactionId: transaction.id,
            amount: parsedAmount,
            currency: updatedWallet.currency,
            balanceAfter: newBalance,
            status: transaction.status,
            payout: payoutInfo,
            estimatedArrival: '1–2 business days',
            createdAt: transaction.createdAt,
        }));
    }
    catch (error) {
        next(error);
    }
};
