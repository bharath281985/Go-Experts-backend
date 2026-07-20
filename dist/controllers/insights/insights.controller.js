import { InsightsService } from "../../services/insights/insights.service.js";
export const getDashboardOverview = async (_req, res, next) => {
    try {
        const data = await InsightsService.getDashboardOverview();
        res.json({ success: true, ...data });
    }
    catch (err) {
        next(err);
    }
};
export const getReportsOverview = async (_req, res, next) => {
    try {
        const data = await InsightsService.getReportsOverview();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
};
export const getAnalyticsOverview = async (_req, res, next) => {
    try {
        const data = await InsightsService.getAnalyticsOverview();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
};
export const getMarketingOverview = async (_req, res, next) => {
    try {
        const data = await InsightsService.getMarketingOverview();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
};
