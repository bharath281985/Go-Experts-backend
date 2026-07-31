import { Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getWalletSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    return res.json(successResponse('Wallet summary retrieved', wallet || { balance: 0, currency: 'INR' }));
  } catch (error) { next(error); }
};

export const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) return res.json(successResponse('Transactions retrieved', [], { page: 1, limit: 20, total: 0, totalPages: 0 }));
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    let transactions: any[] = [];
    let total = 0;

    try {
      [transactions, total] = await Promise.all([
        prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.walletTransaction.count({ where: { walletId: wallet.id } })
      ]);
    } catch (err) {
      try {
        const rawTx: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, wallet_id as walletId, type, amount, description, created_at as createdAt FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          wallet.id, limit, skip
        );
        transactions = rawTx.map(t => ({ ...t, status: 'completed' }));
        const rawCount: any[] = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*) as cnt FROM wallet_transactions WHERE wallet_id = ?`,
          wallet.id
        );
        total = Number(rawCount[0]?.cnt || 0);
      } catch {
        transactions = [];
        total = 0;
      }
    }

    return res.json(successResponse('Transactions retrieved', transactions, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }));
  } catch (error) {
    return res.json(successResponse('Transactions retrieved', [], { page: 1, limit: 20, total: 0, totalPages: 0 }));
  }
};

export const getCredits = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) return res.json(successResponse('Credits retrieved', []));
    const credits = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id, type: 'credit' } });
    return res.json(successResponse('Credits retrieved', credits));
  } catch (error) { next(error); }
};

export const getDebits = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) return res.json(successResponse('Debits retrieved', []));
    const debits = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id, type: 'debit' } });
    return res.json(successResponse('Debits retrieved', debits));
  } catch (error) { next(error); }
};

export const getPendingPayouts = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Pending payouts', []));
export const getPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Payment history', []));

// ─── Request Withdrawal (Bank / UPI) ───────────────────────────────────────
export const requestWithdrawal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, method, bankDetails, upiDetails } = req.body as {
      amount: number;
      method: 'bank' | 'upi';
      bankDetails?: {
        accountHolderName: string;
        accountNumber: string;
        ifscCode: string;
        bankName: string;
      };
      upiDetails?: {
        upiId: string;
      };
    };

    // ── Validate amount ──────────────────────────────────────────────────
    const parsedAmount = parseFloat(String(amount));
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json(errorResponse('Withdrawal amount must be greater than 0', 'VALIDATION_ERROR'));
    }
    if (parsedAmount < 500) {
      return res.status(400).json(errorResponse('Minimum withdrawal amount is ₹500', 'VALIDATION_ERROR'));
    }

    // ── Validate method ──────────────────────────────────────────────────
    if (!method || !['bank', 'upi'].includes(method)) {
      return res.status(400).json(errorResponse("Method must be 'bank' or 'upi'", 'VALIDATION_ERROR'));
    }

    // ── Validate method-specific details ─────────────────────────────────
    if (method === 'bank') {
      if (!bankDetails?.accountHolderName || !bankDetails?.accountNumber || !bankDetails?.ifscCode || !bankDetails?.bankName) {
        return res.status(400).json(errorResponse(
          'Bank details are required: accountHolderName, accountNumber, ifscCode, bankName',
          'VALIDATION_ERROR'
        ));
      }
    }
    if (method === 'upi') {
      if (!upiDetails?.upiId) {
        return res.status(400).json(errorResponse('UPI ID is required', 'VALIDATION_ERROR'));
      }
    }

    // ── Fetch wallet ──────────────────────────────────────────────────────
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) {
      return res.status(404).json(errorResponse('Wallet not found', 'NOT_FOUND'));
    }

    // ── Check sufficient balance ──────────────────────────────────────────
    if (wallet.balance < parsedAmount) {
      return res.status(400).json(errorResponse(
        `Insufficient balance. Available: ₹${wallet.balance.toFixed(2)}`,
        'INSUFFICIENT_BALANCE'
      ));
    }

    // ── Deduct balance & create transaction atomically ────────────────────
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
            ? `Bank withdrawal to ${bankDetails!.bankName} ****${bankDetails!.accountNumber.slice(-4)}`
            : `UPI withdrawal to ${upiDetails!.upiId}`,
          balanceAfter: newBalance,
        },
      }),
    ]);

    // ── Build response payload ────────────────────────────────────────────
    const payoutInfo = method === 'bank'
      ? {
          method: 'bank',
          accountHolderName: bankDetails!.accountHolderName,
          accountNumber: `****${bankDetails!.accountNumber.slice(-4)}`,
          ifscCode: bankDetails!.ifscCode,
          bankName: bankDetails!.bankName,
        }
      : {
          method: 'upi',
          upiId: upiDetails!.upiId,
        };

    return res.status(201).json(successResponse('Withdrawal request submitted successfully', {
      transactionId: transaction.id,
      amount: parsedAmount,
      currency: updatedWallet.currency,
      balanceAfter: newBalance,
      status: 'pending',
      payout: payoutInfo,
      estimatedArrival: '1–3 business days',
      createdAt: transaction.createdAt,
    }));
  } catch (error) {
    next(error);
  }
};
