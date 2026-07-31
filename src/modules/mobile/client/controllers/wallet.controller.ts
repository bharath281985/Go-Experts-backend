import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';

export const getWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    return res.json(successResponse('Wallet retrieved', wallet || { balance: 0, currency: 'INR' }));
  } catch (error) { next(error); }
};

export const getTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) return res.json(successResponse('Transactions', []));
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, skip, take: limit }),
      prisma.walletTransaction.count({ where: { walletId: wallet.id } })
    ]);
    return res.json(successResponse('Transactions retrieved', transactions, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
};
