import { Request, Response, NextFunction } from "express";
import { InsightsService } from "../../services/insights/insights.service.js";

export const getDashboardOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await InsightsService.getDashboardOverview();
    res.json({ success: true, ...data });
  } catch (err) {
    next(err);
  }
};

export const getReportsOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await InsightsService.getReportsOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getAnalyticsOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await InsightsService.getAnalyticsOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getMarketingOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await InsightsService.getMarketingOverview();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
