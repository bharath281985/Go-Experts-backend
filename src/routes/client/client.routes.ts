import { Router } from "express";
import { 
  getClientDashboard,
  getClientProfile,
  updateClientProfile,
  listClientProjects,
  getClientPipeline,
  createClientProject,
  getClientProject,
  updateClientProject,
  deleteClientProject,
  listProjectApplications,
  listClientApplications,
  listClientContracts,
  getClientProposal,
  shortlistProposal,
  offerProposal,
  rejectProposal,
  interviewProposal
} from "../../controllers/client/client.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/media/media.controller.js";
import { getMyVerification, updateMyVerification, deleteMyVerification } from "../../controllers/verification/verification.controller.js";
const router = Router();

router.use(authMiddleware as any);
router.use(requireOnboarding as any);
router.use(portalRoleMiddleware(["client"]) as any);

router.get("/dashboard", getClientDashboard as any);

router.get("/profile", getClientProfile as any);
router.patch("/profile", updateClientProfile as any);
router.put("/profile", updateClientProfile as any);

router.get("/verification", getMyVerification as any);
router.patch("/verification", updateMyVerification as any);
router.delete("/verification", deleteMyVerification as any);

router.get("/projects", listClientProjects as any);
router.post("/projects/search", listClientProjects as any);
router.get("/pipeline", getClientPipeline as any);
router.post("/projects", createClientProject as any);
router.get("/projects/:id", getClientProject as any);
router.patch("/projects/:id", updateClientProject as any);
router.put("/projects/:id", updateClientProject as any);
router.delete("/projects/:id", deleteClientProject as any);
router.get("/projects/:id/applications", listProjectApplications as any);

router.get("/applications", listClientApplications as any);

// router.post("/projects/:id/invite", inviteFreelancer as any);
//   router.get("/projects/:id/invitations", listProjectInvitations as any);
  router.get("/projects/:id/proposals", listProjectApplications as any);
  router.get("/proposals/:id", getClientProposal as any);
  router.post("/proposals/:id/shortlist", shortlistProposal as any);
  router.post("/proposals/:id/offer", offerProposal as any);
  
router.post("/proposals/:id/reject", rejectProposal as any);
router.post("/proposals/:id/interview", interviewProposal as any);

router.get("/contracts", listClientContracts as any);
// router.get("/tasks", listClientTasks as any);
// router.post("/tasks", addClientTask as any);
// router.patch("/tasks/:id", updateClientTask as any);
// router.put("/tasks/:id", updateClientTask as any);
// router.delete("/tasks/:id", deleteClientTask as any);

// router.get("/meetings", listClientMeetings as any);
// router.post("/meetings", createClientMeeting as any);

// router.get("/messages", listClientMessages as any);
// router.post("/messages", createClientMessage as any);

// router.get("/wallet", getClientWallet as any);
// router.post("/wallet/fund", fundClientWallet as any);
// router.post("/wallet/withdraw", withdrawClientWallet as any);

// router.get("/invoices", listClientInvoices as any);
// router.get("/payments", listClientPayments as any);

// router.get("/reviews", listClientReviews as any);
// router.post("/reviews", createClientReview as any);

// router.get("/analytics", getClientAnalytics as any);

// router.get("/notifications", listClientNotifications as any);
// router.patch("/notifications/read-all", markAllClientNotificationsRead as any);
// router.patch("/notifications/:id/read", markClientNotificationRead as any);

// router.get("/settings", getClientSettings as any);
// router.patch("/settings", updateClientSettings as any);

// router.get("/subscriptions", listClientSubscriptions as any);
// router.post("/subscriptions/purchase", purchaseClientSubscription as any);

// router.get("/documents", listClientDocuments as any);
// router.post("/documents", addClientDocument as any);
// router.delete("/documents/:id", deleteClientDocument as any);

// router.get("/team", listClientTeam as any);
// router.get("/invitations", listClientInvitations as any);
// router.post("/team", addClientTeamMember as any);
// router.delete("/team/:id", deleteClientTeamMember as any);

// router.get("/pipeline", listClientPipeline as any);
// router.get("/referrals", getClientReferrals as any);
// router.get("/reports", getClientReports as any);

// router.get("/api-keys", listClientApiKeys as any);
// router.post("/api-keys", generateClientApiKey as any);
// router.delete("/api-keys/:id", revokeClientApiKey as any);

router.post("/media/upload", upload.single("file"), uploadFile as any);

// Saved freelancers (bookmark)
// router.get("/freelancers/saved", listSavedFreelancers as any);
// router.post("/freelancers/save", toggleSavedFreelancer as any);
// router.delete("/freelancers/saved/:id", removeSavedFreelancer as any);

// Share freelancer (track)
// router.post("/freelancers/share", shareFreelancer as any);

export default router;

