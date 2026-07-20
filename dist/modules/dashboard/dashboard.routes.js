import { Router } from "express";
import { getDashboardStats, getDashboardCharts, getRecentActivity } from "./dashboard.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";
const router = Router();
router.use(authMiddleware);
router.get("/stats", getDashboardStats);
router.get("/charts", getDashboardCharts);
router.get("/recent-activity", getRecentActivity);
export default router;
