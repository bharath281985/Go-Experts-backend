import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { createReport, listReports, updateReportStatus } from "../../controllers/support/support.controller.js";

const router = Router();

router.use(authMiddleware);

// User endpoints
router.post("/reports", createReport as any);

// Admin endpoints
router.get("/reports", listReports as any);
router.patch("/reports/:id/status", updateReportStatus as any);

export default router;
