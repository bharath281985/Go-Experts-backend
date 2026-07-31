import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { AppError } from './app-error.js';

export interface MappedError {
  status: number;
  message: string;
  code: string;
  errors: unknown[];
}

const isPrismaColumnError = (message: string) =>
  /column .* does not exist|unknown column|invalid.*invocation/i.test(message);

export const mapError = (err: unknown): MappedError => {
  const errAny = err as any;
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      message: err.message,
      code: err.code,
      errors: err.errors,
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError || errAny?.code?.startsWith?.('P')) {
    switch (errAny.code) {
      case 'P2002':
        return {
          status: 409,
          message: 'This record already exists',
          code: 'DUPLICATE_RECORD',
          errors: [],
        };
      case 'P2025':
        return {
          status: 404,
          message: 'Record not found',
          code: 'NOT_FOUND',
          errors: [],
        };
      case 'P2022':
      case 'P2021':
        console.error('[DB] Column missing:', errAny.message);
        return {
          status: 503,
          message: 'Service temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
          errors: [],
        };
      case 'P1000':
        console.error('[DB] Authentication failed:', errAny.message);
        return {
          status: 503,
          message: 'Service temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
          errors: [],
        };
      default:
        console.error('[Prisma]', errAny.code, errAny.message);
        return {
          status: 500,
          message: 'Service temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
          errors: [],
        };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError || errAny?.name === 'PrismaClientValidationError') {
    console.error('[Prisma validation]', errAny.message);
    return {
      status: 500,
      message: 'Service temporarily unavailable. Please try again later.',
      code: 'SERVICE_UNAVAILABLE',
      errors: [],
    };
  }

  if (err instanceof jwt.TokenExpiredError) {
    return {
      status: 401,
      message: 'Session expired. Please login again.',
      code: 'TOKEN_EXPIRED',
      errors: [],
    };
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return {
      status: 401,
      message: 'Invalid session. Please login again.',
      code: 'INVALID_TOKEN',
      errors: [],
    };
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message === 'ACCOUNT_INACTIVE') {
    return {
      status: 403,
      message: 'Your account is inactive. Please contact support.',
      code: 'ACCOUNT_INACTIVE',
      errors: [],
    };
  }

  if (message === 'FIREBASE_NOT_CONFIGURED') {
    return {
      status: 503,
      message: 'Social login is not configured yet',
      code: 'SOCIAL_LOGIN_NOT_CONFIGURED',
      errors: [],
    };
  }

  if (isPrismaColumnError(message)) {
    console.error('[DB schema]', message);
    return {
      status: 503,
      message: 'Service temporarily unavailable. Please try again later.',
      code: 'SERVICE_UNAVAILABLE',
      errors: [],
    };
  }

  if (/password reset/i.test(message)) {
    return {
      status: 400,
      message: 'Invalid or expired reset token',
      code: 'INVALID_RESET_TOKEN',
      errors: [],
    };
  }

  if (/prisma|sql|invocation|constraint/i.test(message)) {
    console.error('[Internal]', message);
    return {
      status: 500,
      message: 'Something went wrong. Please try again later.',
      code: 'INTERNAL_SERVER_ERROR',
      errors: [],
    };
  }

  const anyErr = err as { status?: number; code?: string; errors?: unknown[] };
  return {
    status: anyErr.status || 500,
    message: message || 'Something went wrong. Please try again later.',
    code: anyErr.code || 'INTERNAL_SERVER_ERROR',
    errors: anyErr.errors || [],
  };
};
