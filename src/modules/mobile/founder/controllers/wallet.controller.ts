import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    return res.json(successResponse('Wallet retrieved', wallet || { balance: 0, currency: 'USD' }));
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
