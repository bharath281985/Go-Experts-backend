import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';

export const getHealth = async (req: any, res: Response, next: NextFunction) => {
  try {
    const dbStatus = await prisma.$queryRaw`SELECT 1`.then(() => 'UP').catch(() => 'DOWN');
    return res.json(successResponse('System Health', {
      api: 'UP',
      database: dbStatus,
      timestamp: new Date()
    }));
  } catch (error) { next(error); }
};

export const getStatus = async (req: any, res: Response, next: NextFunction) => {
  try {
    const memory = process.memoryUsage();
    return res.json(successResponse('System Status', {
      uptime: process.uptime(),
      memory: {
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`
      }
    }));
  } catch (error) { next(error); }
};

export const getStatistics = async (req: any, res: Response, next: NextFunction) => {
  try {
    const [pendingNotifications, totalAudits] = await Promise.all([
      prisma.notificationQueue.count({ where: { status: 'pending' } }),
      prisma.auditLog.count()
    ]);
    return res.json(successResponse('System Statistics', {
      queues: {
        notifications: pendingNotifications
      },
      metrics: {
        totalAudits: totalAudits
      }
    }));
  } catch (error) { next(error); }
};
