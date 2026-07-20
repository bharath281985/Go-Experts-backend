import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getAnalyticsOverview,
  getDashboardOverview,
  getMarketingOverview,
  getReportsOverview,
} from "../../controllers/insights/insights.controller.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/overview", getDashboardOverview);

export default router;
