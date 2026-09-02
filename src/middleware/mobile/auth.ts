import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { errorResponse } from '../../core/response.js';

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : 'dev-only-jwt-secret-min16');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export interface AuthRequest extends Request {
  user?: any;
}

const authEpochKey = (userId: string) => `auth_epoch:${userId}`;

const getAuthEpoch = async (userId: string): Promise<number> => {
  const row = await prisma.setting.findUnique({ where: { key: authEpochKey(userId) } });
  const n = row ? Number(row.value) : 0;
  return Number.isFinite(n) ? n : 0;
};

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        errorResponse('Invalid session. Please login again.', 'INVALID_TOKEN')
      );
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
      epoch?: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(401).json(
        errorResponse('Invalid session. Please login again.', 'INVALID_TOKEN')
      );
    }

    if (user.status !== 'active') {
      return res.status(403).json(
        errorResponse('Your account is inactive. Please contact support.', 'ACCOUNT_INACTIVE')
      );
    }

    if (typeof decoded.epoch === 'number') {
      const epoch = await getAuthEpoch(user.id);
      if (decoded.epoch !== epoch) {
        return res.status(401).json(
          errorResponse('Session revoked. Please login again.', 'SESSION_REVOKED')
        );
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json(
        errorResponse('Session expired. Please login again.', 'TOKEN_EXPIRED')
      );
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json(
        errorResponse('Invalid session. Please login again.', 'INVALID_TOKEN')
      );
    }
    console.error('[Auth middleware]', error);
    return res.status(401).json(
      errorResponse('Invalid session. Please login again.', 'INVALID_TOKEN')
    );
  }
};

export const authenticateOptional = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      role: string;
      epoch?: number;
    };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });
    if (user && user.status === 'active') {
      if (typeof decoded.epoch === 'number') {
        const epoch = await getAuthEpoch(user.id);
        if (decoded.epoch !== epoch) return next();
      }
      req.user = user;
    }
    return next();
  } catch {
    return next();
  }
};

export const authorizeRole = (roles: string | string[]) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(errorResponse('Invalid session. Please login again.', 'INVALID_TOKEN'));
    }
    // For portal (mobile) users, allow any role
    if (req.user.type === 'portal') {
      return next();
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json(errorResponse('You do not have permission to access this resource.', 'FORBIDDEN'));
    }
    next();
    next();
  };
};
