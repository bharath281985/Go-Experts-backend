import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { approveProject, rejectProject, publishProject, shortlistProposal, rejectProposal, interviewProposal, offerProposal, acceptProposal, withdrawProposal, createContractFromProposal, patchContractStatus, createMilestone, approveMilestone, rejectMilestone, requestChangesMilestone, patchTaskStatus, createTaskComment, createTaskAttachment, createReview, } from "../../controllers/workflows/workflows.controller.js";
const router = Router();
// Protect all workflow routes
router.use(authMiddleware);
// Project Lifecycle
router.post("/projects/:id/approve", approveProject);
router.post("/projects/:id/reject", rejectProject);
router.post("/projects/:id/publish", publishProject);
// Proposals Lifecycle
router.post("/proposals/:id/shortlist", shortlistProposal);
router.post("/proposals/:id/reject", rejectProposal);
router.post("/proposals/:id/interview", interviewProposal);
router.post("/proposals/:id/offer", offerProposal);
router.post("/proposals/:id/accept", acceptProposal);
router.post("/proposals/:id/withdraw", withdrawProposal);
// Contracts Engine
router.post("/contracts/from-proposal/:proposalId", createContractFromProposal);
router.patch("/contracts/:id/status", patchContractStatus);
// Milestone Engine
router.post("/milestones", createMilestone);
router.patch("/milestones/:id/approve", approveMilestone);
router.patch("/milestones/:id/reject", rejectMilestone);
router.patch("/milestones/:id/request-changes", requestChangesMilestone);
// Task Engine (status/comments/attachments — create/update go through admin CRUD)
router.patch("/tasks/:id/status", patchTaskStatus);
router.post("/tasks/:id/comments", createTaskComment);
router.post("/tasks/:id/attachments", createTaskAttachment);
// Review Engine
router.post("/reviews", createReview);
export default router;
