import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

class HttpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// List all withdrawals (optional filter by status)
export const listWithdrawals = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Admin access required", 403);
    }
    const { status } = req.query;
    const whereClause: any = { type: "withdrawal" };
    if (status) {
      whereClause.status = status;
    }
    const transactions = await prisma.walletTransaction.findMany({
      where: whereClause,
      include: {
        wallet: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows: transactions, total: transactions.length });
  } catch (err) {
    next(err);
  }
};

// Approve withdrawal
export const approveWithdrawal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Super Admin access required", 403);
    }
    const { id } = req.params;
    const txn = await prisma.walletTransaction.findUnique({ where: { id } });
    if (!txn || txn.type !== "withdrawal") {
      throw new HttpError("Withdrawal not found", 404);
    }
    if (txn.status !== "pending") {
      throw new HttpError(`Cannot approve a ${txn.status} withdrawal`);
    }

    const updated = await prisma.walletTransaction.update({
      where: { id },
      data: { status: "completed" },
    });

    // Notify user
    try {
      const wallet = await prisma.wallet.findUnique({ where: { id: txn.walletId } });
      if (wallet?.userId) {
        await prisma.notification.create({
          data: {
            userId: wallet.userId,
            title: "Withdrawal Approved",
            message: `Your withdrawal of ₹${txn.amount} has been approved.`,
            type: "WITHDRAWAL_APPROVED",
            channel: "in-app"
          }
        });
      }
    } catch {}

    res.json({ success: true, message: "Withdrawal approved successfully", data: updated });
  } catch (err) {
    next(err);
  }
};

// Reject withdrawal (Refunds wallet)
export const rejectWithdrawal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Super Admin access required", 403);
    }
    const { id } = req.params;
    const txn = await prisma.walletTransaction.findUnique({ 
      where: { id },
      include: { wallet: true }
    });
    
    if (!txn || txn.type !== "withdrawal") {
      throw new HttpError("Withdrawal not found", 404);
    }
    if (txn.status !== "pending") {
      throw new HttpError(`Cannot reject a ${txn.status} withdrawal`);
    }

    // Refund and mark rejected
    const result = await prisma.$transaction(async (tx) => {
      const updatedTxn = await tx.walletTransaction.update({
        where: { id },
        data: { status: "rejected" },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: txn.wallet.id },
        data: { balance: { increment: txn.amount } }
      });

      // Create refund transaction log
      await tx.walletTransaction.create({
        data: {
          walletId: txn.wallet.id,
          type: "refund",
          amount: txn.amount,
          direction: "credit",
          description: `Refund for rejected withdrawal (${id.slice(0, 8)})`,
          balanceAfter: updatedWallet.balance,
          status: "completed"
        }
      });

      return updatedTxn;
    });

    res.json({ success: true, message: "Withdrawal rejected and refunded", data: result });
  } catch (err) {
    next(err);
  }
};
