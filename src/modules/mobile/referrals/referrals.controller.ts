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
    const settingsRecord = await prisma.setting.findUnique({ where: { key: "app_settings" } });
    let appSettings: any = {};
    if (settingsRecord) {
      try {
        appSettings = JSON.parse(settingsRecord.value);
      } catch(e) {}
    }

    const publicSettings = {
      welcomeBonusEnabled: Boolean(appSettings.welcome_bonus_enabled ?? true),
      welcomeBonusAmount: Number(appSettings.welcome_bonus_amount ?? 99),
      referralRewardAmount: Number(appSettings.referral_reward_amount ?? 25)
    };

    if (!req.user?.id) {
      return res.json(successResponse('Referrals retrieved', {
        ...publicSettings,
        referralCode: null,
        referralLink: null,
        qrCode: null,
        stats: { total: 0, pending: 0, rewarded: 0, totalReward: 0 },
        history: [],
      }));
    }

    const userId = req.user.id;
    const [referralCode, referrals] = await Promise.all([
      ensureReferralCode(userId, req.user.referralCode),
      prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          rewards: {
            where: { status: { in: ['active', 'ACTIVE', 'pending', 'PENDING', 'rewarded', 'REWARDED'] } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const refereeIds = referrals.map(r => r.refereeId).filter(Boolean);
    const referees = await prisma.user.findMany({
      where: { id: { in: refereeIds } },
      select: { id: true, fullName: true, email: true, avatarUrl: true }
    });
    const refereeMap = new Map(referees.map(r => [r.id, r]));

    const history = referrals.map((referral) => {
      const status = String(referral.status || 'pending').toLowerCase();
      const isSuccess = ['rewarded', 'completed', 'successful'].includes(status);

      let rewardSum = referral.rewards?.reduce((sum, reward) => sum + (Number(reward.amount) || 0), 0) || 0;
      if (rewardSum === 0 && isSuccess) {
        rewardSum = publicSettings.referralRewardAmount;
      }

      return {
        id: referral.id,
        user: refereeMap.get(referral.refereeId) || { id: referral.refereeId, fullName: 'Unknown User', email: '', avatarUrl: null },
        status,
        reward: rewardSum,
        points: referral.rewards?.reduce((sum, reward) => sum + (Number(reward.points) || 0), 0) || 0,
        createdAt: referral.createdAt,
      };
    });
    const totalReward = history.reduce((sum, referral) => sum + referral.reward, 0);
    const referralLink = `https://goexperts.com/ref/${referralCode}`;

    return res.json(successResponse('Referrals retrieved', {
      ...publicSettings,
      referralCode,
      referralLink,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(referralLink)}`,
      stats: {
        total: history.length,
        pending: history.filter((referral) => referral.status === 'pending').length,
        rewarded: history.filter((referral) => ['rewarded', 'completed', 'successful'].includes(referral.status)).length,
        totalReward,
      },
      history,
    }));
  } catch (error) {
    next(error);
  }
};
