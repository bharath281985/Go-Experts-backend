import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

type Db = Prisma.TransactionClient | typeof prisma;

const VALID_ROLES = ['freelancer', 'client', 'investor', 'founder'] as const;
export type UserRole = (typeof VALID_ROLES)[number];

export const isValidRole = (role: string): role is UserRole =>
  VALID_ROLES.includes(role as UserRole);

export const createRoleProfile = async (userId: string, role: string, db: Db = prisma) => {
  switch (role) {
    case 'freelancer':
      await db.freelancerProfile.create({ data: { userId } });
      break;
    case 'client':
      await db.clientProfile.create({ data: { userId } });
      break;
    case 'investor':
      await db.investorProfile.create({ data: { userId } });
      break;
    case 'founder':
      await db.founderProfile.create({ data: { userId } });
      break;
  }
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

export const bootstrapNewUser = async (userId: string, role: string, db: Db = prisma) => {
  await createRoleProfile(userId, role, db);
  await bootstrapUserResources(userId, db);
};
