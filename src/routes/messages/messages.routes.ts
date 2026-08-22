import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import {
  listConversations,
  getConversationMessages,
  createOrFindConversation
} from "../../controllers/messages/messages.controller.js";

const router = Router();

// All message routes require authentication
router.use(authMiddleware);

router.get("/conversations", listConversations as any);
router.post("/conversations", createOrFindConversation as any);
router.get("/conversations/:id/messages", getConversationMessages as any);

export default router;

