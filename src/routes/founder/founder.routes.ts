import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/media/media.controller.js";
import {
  getFounderDashboard,
  getFounderProfile,
  updateFounderProfile,
  getFounderStartup,
  updateFounderStartup,
  getBusinessPlan,
  putBusinessPlan,
  getPitchDeck,
  putPitchDeck,
  getFounderFunding,
  listInvestorRequests,
  respondInvestorRequest,
  listFounderInvestors,
  listFounderTeam,
  addFounderTeamMember,
  deleteFounderTeamMember,
  listFounderDocuments,
  addFounderDocument,
  listFounderMilestones,
  addFounderMilestone,
  updateFounderMilestone,
  listFounderMeetings,
  createFounderMeeting,
  listFounderMessages,
  createFounderMessage,
  getFounderWallet,
  depositFounderWallet,
  withdrawFounderWallet,
  listFounderInvoices,
  getFounderAnalytics,
  getFounderReports,
  listFounderNotifications,
  markFounderNotificationRead,
  markAllFounderNotificationsRead,
  listFounderSubscriptions,
  purchaseFounderSubscription,
  getFounderSettings,
  updateFounderSettings,
} from "../../controllers/founder/founder.controller.js";

const router = Router();

router.use(authMiddleware as any);
router.use(portalRoleMiddleware(["founder"]) as any);

router.get("/dashboard", getFounderDashboard as any);

router.get("/profile", getFounderProfile as any);
router.patch("/profile", updateFounderProfile as any);
router.put("/profile", updateFounderProfile as any);

router.get("/startup", getFounderStartup as any);
router.patch("/startup", updateFounderStartup as any);
router.put("/startup", updateFounderStartup as any);

router.get("/business-plan", getBusinessPlan as any);
router.put("/business-plan", putBusinessPlan as any);

router.get("/pitch-deck", getPitchDeck as any);
router.put("/pitch-deck", putPitchDeck as any);

router.get("/funding", getFounderFunding as any);

router.get("/investor-requests", listInvestorRequests as any);
router.post("/investor-requests/:id/respond", respondInvestorRequest as any);

router.get("/investors", listFounderInvestors as any);

router.get("/team", listFounderTeam as any);
router.post("/team", addFounderTeamMember as any);
router.delete("/team/:id", deleteFounderTeamMember as any);

router.get("/documents", listFounderDocuments as any);
router.post("/documents", addFounderDocument as any);

router.get("/milestones", listFounderMilestones as any);
router.post("/milestones", addFounderMilestone as any);
router.patch("/milestones/:id", updateFounderMilestone as any);

router.get("/meetings", listFounderMeetings as any);
router.post("/meetings", createFounderMeeting as any);

router.get("/messages", listFounderMessages as any);
router.post("/messages", createFounderMessage as any);

router.get("/wallet", getFounderWallet as any);
router.post("/wallet/deposit", depositFounderWallet as any);
router.post("/wallet/withdraw", withdrawFounderWallet as any);

router.get("/invoices", listFounderInvoices as any);

router.get("/analytics", getFounderAnalytics as any);
router.get("/reports", getFounderReports as any);

router.get("/notifications", listFounderNotifications as any);
router.patch("/notifications/read-all", markAllFounderNotificationsRead as any);
router.patch("/notifications/:id/read", markFounderNotificationRead as any);

router.get("/subscription", listFounderSubscriptions as any);
router.post("/subscription/purchase", purchaseFounderSubscription as any);

router.get("/settings", getFounderSettings as any);
router.patch("/settings", updateFounderSettings as any);

router.post("/media/upload", upload.single("file"), uploadFile as any);

export default router;
