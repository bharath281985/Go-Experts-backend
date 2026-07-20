import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getMarketingOverview } from "../../controllers/insights/insights.controller.js";
const router = Router();
router.use(authMiddleware);
router.get("/overview", getMarketingOverview);
export default router;
