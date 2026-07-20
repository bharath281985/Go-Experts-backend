import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getDashboardOverview, } from "../../controllers/insights/insights.controller.js";
const router = Router();
router.use(authMiddleware);
router.get("/overview", getDashboardOverview);
export default router;
