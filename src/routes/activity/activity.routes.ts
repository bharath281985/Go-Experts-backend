import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getBusinessActivities } from "../../controllers/activity/activity.controller.js";

const router = Router();

router.use(authMiddleware);

router.get("/", getBusinessActivities as any);

export default router;
