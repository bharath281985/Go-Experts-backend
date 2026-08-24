import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import {
  listConversations,
  getConversationMessages,
  createOrFindConversation,
  updateConversationStatus,
  addAdminNote,
  updateConversationState
} from "../../controllers/messages/messages.controller.js";

const router = Router();

// All message routes require authentication
router.use(authMiddleware);

router.get("/conversations", listConversations as any);
router.post("/conversations", createOrFindConversation as any);
router.get("/conversations/:id/messages", getConversationMessages as any);
router.patch("/conversations/:id/status", updateConversationStatus as any);
router.post("/conversations/:id/admin-note", addAdminNote as any);
router.put("/conversations/:id/state", updateConversationState as any);

export default router;

