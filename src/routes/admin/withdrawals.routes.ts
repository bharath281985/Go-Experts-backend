import { Router } from "express";
import { authMiddleware as authenticate } from "../../middlewares/auth.middleware.js";
import {
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
} from "../../controllers/admin/withdrawals.controller.js";

const router = Router();

router.use(authenticate);

router.get("/pending", listWithdrawals as any);
router.post("/:id/approve", approveWithdrawal as any);
router.post("/:id/reject", rejectWithdrawal as any);

export default router;
