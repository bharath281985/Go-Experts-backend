import { Response, NextFunction } from 'express';
import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middleware/auth.js';

const ensureReferralCode = async (userId: string, existingCode?: string | null) => {
  if (existingCode) return existingCode;

  const baseCode = `GE-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const owner = await prisma.user.findUnique({ where: { referralCode: baseCode }, select: { id: true } });
  const code = !owner || owner.id === userId
    ? baseCode
    : `${baseCode}-${userId.replace(/-/g, '').slice(-4).toUpperCase()}`;

  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  return code;
};

export const getMyReferrals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
    }

    const userId = req.user.id;
    const [referralCode, referrals] = await Promise.all([
      ensureReferralCode(userId, req.user.referralCode),
      prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          referee: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          rewards: { where: { status: 'active' }, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const history = referrals.map((referral) => ({
      id: referral.id,
      user: referral.referee,
      status: referral.status,
      reward: referral.rewards.reduce((sum, reward) => sum + reward.amount, 0),
      points: referral.rewards.reduce((sum, reward) => sum + reward.points, 0),
      createdAt: referral.createdAt,
    }));
    const totalReward = history.reduce((sum, referral) => sum + referral.reward, 0);
    const referralLink = `https://goexperts.com/ref/${referralCode}`;

    return res.json(successResponse('Referrals retrieved', {
      referralCode,
      referralLink,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(referralLink)}`,
      stats: {
        total: history.length,
        pending: history.filter((referral) => referral.status === 'pending').length,
        rewarded: history.filter((referral) => referral.status === 'rewarded').length,
        totalReward,
      },
      history,
    }));
  } catch (error) {
    next(error);
  }
};
