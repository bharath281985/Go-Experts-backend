import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getAnalyticsOverview } from "../../controllers/insights/insights.controller.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/overview", getAnalyticsOverview);

export default router;
