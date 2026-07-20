import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getCustomReport } from "../../controllers/analytics/reports.controller.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/custom", getCustomReport);

export default router;
