import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

type Db = Prisma.TransactionClient | typeof prisma;

const VALID_ROLES = ['freelancer', 'client', 'investor', 'founder'] as const;
export type UserRole = (typeof VALID_ROLES)[number];

export const isValidRole = (role: string): role is UserRole =>
  VALID_ROLES.includes(role as UserRole);

export const createRoleProfile = async (userId: string, role?: string, db: Db = prisma) => {
  // In the unified role model, ensure all 4 role profiles exist for every user
  await Promise.all([
    db.freelancerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }).catch(() => null),
    db.clientProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }).catch(() => null),
    db.investorProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }).catch(() => null),
    db.founderProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }).catch(() => null),
  ]);
};

export const bootstrapUserResources = async (userId: string, db: Db = prisma) => {
  await db.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, currency: 'INR' },
  });

  await db.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
};

export const bootstrapNewUser = async (userId: string, role?: string, db: Db = prisma) => {
  await createRoleProfile(userId, role, db);
  await bootstrapUserResources(userId, db);
};
