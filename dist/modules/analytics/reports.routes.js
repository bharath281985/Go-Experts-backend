import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { getCustomReport } from "./reports.controller.js";
const router = Router();
router.use(authMiddleware);
router.get("/custom", getCustomReport);
export default router;
