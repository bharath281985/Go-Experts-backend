import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  listRules,
  getRuleDetails,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  getAutomationLogs
} from "../../controllers/scheduler/automation.controller.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/", listRules);
router.get("/logs", getAutomationLogs);
router.get("/:id", getRuleDetails);
router.post("/", createRule);
router.put("/:id", updateRule);
router.delete("/:id", deleteRule);
router.post("/:id/toggle", toggleRule);

export default router;
