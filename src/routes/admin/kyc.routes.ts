import { Router } from "express";
import { getUserKyc, updateUserKyc, deleteUserKyc } from "../../controllers/admin/kyc.controller.js";

const router = Router();

router.get("/:id", getUserKyc);
router.patch("/:id", updateUserKyc);
router.delete("/:id", deleteUserKyc);
router.post("/:id", updateUserKyc);

export default router;
