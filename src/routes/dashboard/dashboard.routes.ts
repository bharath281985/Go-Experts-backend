import { Router } from "express";
import { getDashboardStats, getDashboardCharts, getRecentActivity } from "../../controllers/dashboard/dashboard.controller.js";
import { getSidebarCounts, markSidebarIndustryRead } from "../../controllers/admin/sidebar-counts.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/stats", getDashboardStats);
router.get("/charts", getDashboardCharts);
router.get("/recent-activity", getRecentActivity);
router.get("/sidebar-counts", getSidebarCounts);
router.post("/sidebar-counts/read", markSidebarIndustryRead);

export default router;
