import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
export const getWallet = async (req, res, next) => {
    try {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        return res.json(successResponse('Wallet retrieved', wallet || { balance: 0, currency: 'INR' }));
    }
    catch (error) {
        next(error);
    }
};
export const getTransactions = async (req, res, next) => {
    try {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        if (!wallet)
            return res.json(successResponse('Transactions retrieved', []));
        const transactions = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' } });
        return res.json(successResponse('Transactions retrieved', transactions));
    }
    catch (error) {
        next(error);
    }
};
