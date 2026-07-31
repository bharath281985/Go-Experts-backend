import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : 'dev-only-jwt-secret-min16');

export const socketAuth = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    if (!JWT_SECRET) {
      return next(new Error('Authentication error'));
    }
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
      epoch?: number;
    };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.status !== 'active') {
      return next(new Error('User not found'));
    }

    if (typeof decoded.epoch === 'number') {
      const row = await prisma.setting.findUnique({
        where: { key: `auth_epoch:${user.id}` },
      });
      const epoch = row ? Number(row.value) : 0;
      if (decoded.epoch !== epoch) {
        return next(new Error('Session revoked'));
      }
    }

    (socket as any).user = user;
    next();
  } catch {
    next(new Error('Authentication error'));
  }
};
