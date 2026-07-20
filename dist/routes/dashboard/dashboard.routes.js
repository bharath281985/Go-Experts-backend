import { Router } from "express";
import { getDashboardStats, getDashboardCharts, getRecentActivity } from "../../controllers/dashboard/dashboard.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = Router();
router.use(authMiddleware);
router.get("/stats", getDashboardStats);
router.get("/charts", getDashboardCharts);
router.get("/recent-activity", getRecentActivity);
export default router;
