import { Response, NextFunction } from "express";
import { AnalyticsService } from "../../modules/analytics/analytics.service.js";
import { prisma } from "../../config/database.js";

// ============================================================
// AUDIT LOGGING HELPER
// ============================================================
async function logAnalyticsAccess(params: {
  actorId: string;
  action: string;
  description: string;
}) {
  const { actorId, action, description } = params;

  await prisma.activityLog.create({
    data: {
      adminUserId: actorId,
      action: `ANALYTICS_${action.toUpperCase()}`,
      description,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action,
      entity: "analytics",
      ipAddress: "127.0.0.1",
      newValue: JSON.stringify({ accessedAt: new Date() }),
    },
  });
}

// ============================================================
// CACHING CONTROLLER DECORATOR HELPER
// ============================================================
async function executeReport(
  req: any,
  res: Response,
  next: NextFunction,
  reportName: string,
  fetcher: (range: { gte: Date; lte: Date }) => Promise<any>
) {
  try {
    const { filter = "last_30_days", customStart, customEnd, refresh } = req.query;
    const actorId = req.user?.id || "system";

    const cacheKey = `${req.path}_${filter}_${customStart || ""}_${customEnd || ""}`;

    // 1. Force refresh bypass check
    if (refresh !== "true") {
      const cached = AnalyticsService.getCached(cacheKey);
      if (cached) {
        return res.json({ success: true, cached: true, data: cached });
      }
    }

    // 2. Resolve date filter range
    const range = AnalyticsService.getDateRange(
      filter as string,
      customStart as string,
      customEnd as string
    );

    // 3. Query
    const data = await fetcher(range);

    // 4. Cache
    AnalyticsService.setCache(cacheKey, data);

    // 5. Audit Access Log
    await logAnalyticsAccess({
      actorId,
      action: `view_${reportName.toLowerCase()}`,
      description: `Accessed ${reportName} report. Time range: ${filter}`,
    });

    res.json({ success: true, cached: false, data });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// ANALYTICS ENDPOINTS
// ============================================================

export const getDashboardStats = async (req: any, res: Response, next: NextFunction) => {
  await executeReport(req, res, next, "Dashboard", (range) =>
    AnalyticsService.getExecutiveDashboardStats(range)
  );
};

export const getUserStats = async (req: any, res: Response, next: NextFunction) => {
  await executeReport(req, res, next, "Users", (range) =>
    AnalyticsService.getUserAnalytics(range)
  );
};

export const getProjectStats = async (req: any, res: Response, next: NextFunction) => {
  await executeReport(req, res, next, "Projects", (range) =>
    AnalyticsService.getProjectAnalytics(range)
  );
};

export const getStartupStats = async (req: any, res: Response, next: NextFunction) => {
  await executeReport(req, res, next, "Startups", (range) =>
    AnalyticsService.getStartupAnalytics(range)
  );
};

export const getInvestmentStats = async (req: any, res: Response, next: NextFunction) => {
  await executeReport(req, res, next, "Investments", (range) =>
    AnalyticsService.getInvestmentAnalytics(range)
  );
};

export const getFinancialStats = async (req: any, res: Response, next: NextFunction) => {
  await executeReport(req, res, next, "Financials", (range) =>
    AnalyticsService.getFinancialAnalytics(range)
  );
};

export const getSupportStats = async (req: any, res: Response, next: NextFunction) => {
  await executeReport(req, res, next, "Support", (range) =>
    AnalyticsService.getSupportAnalytics(range)
  );
};

export const getSystemStats = async (req: any, res: Response, next: NextFunction) => {
  try {
    const actorId = req.user?.id || "system";
    const data = await AnalyticsService.getSystemAnalytics();

    await logAnalyticsAccess({
      actorId,
      action: "view_system",
      description: "Accessed system health metrics and queue size reports.",
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const refreshCache = async (req: any, res: Response, next: NextFunction) => {
  try {
    const actorId = req.user?.id || "system";
    AnalyticsService.clearCache();

    await logAnalyticsAccess({
      actorId,
      action: "refresh_cache",
      description: "Cleared/invalidated the Analytics report caching layer.",
    });

    res.json({ success: true, message: "Analytics cache cleared successfully." });
  } catch (err) {
    next(err);
  }
};
