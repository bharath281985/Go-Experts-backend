import { Router } from "express";
import { authMiddleware as authenticate } from "../../middlewares/auth.middleware.js";
import {
  listWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  creditWallet
} from "../../controllers/admin/withdrawals.controller.js";

const router = Router();

router.use(authenticate);

router.get("/pending", listWithdrawals as any);
router.get("/all", listWithdrawals as any);
router.post("/:id/approve", approveWithdrawal as any);
router.post("/:id/reject", rejectWithdrawal as any);
router.post("/credit-wallet", creditWallet as any);

export default router;
