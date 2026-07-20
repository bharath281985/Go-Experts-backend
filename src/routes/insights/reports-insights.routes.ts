import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getReportsOverview } from "../../controllers/insights/insights.controller.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/overview", getReportsOverview);

export default router;
