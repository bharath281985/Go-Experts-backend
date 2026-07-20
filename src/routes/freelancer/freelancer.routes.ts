import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/media/media.controller.js";
import {
  getFreelancerDashboard,
  getFreelancerProfile,
  updateFreelancerProfile,
  listFreelancerNotifications,
  markFreelancerNotificationRead,
  markAllFreelancerNotificationsRead,
  getFreelancerVerification,
  updateFreelancerVerification,
  getFreelancerPortfolio,
  createFreelancerPortfolioItem,
  updateFreelancerPortfolioItem,
  deleteFreelancerPortfolioItem,
} from "../../controllers/freelancer/freelancer.controller.js";
import {
  listFreelancerProposals,
  createFreelancerProposal,
  withdrawFreelancerProposal,
  listFreelancerContracts,
  listFreelancerTasks,
  updateFreelancerTask,
  listFreelancerMeetings,
  listFreelancerMessages,
  createFreelancerMessage,
  listFreelancerReviews,
  withdrawFreelancerWallet,
  listFreelancerInvoices,
  listFreelancerSubscriptions,
  purchaseFreelancerSubscription,
  getFreelancerExperience,
  putFreelancerExperience,
  getFreelancerEducation,
  putFreelancerEducation,
  getFreelancerCertificates,
  putFreelancerCertificates,
  getFreelancerSkills,
  putFreelancerSkills,
  listSavedProjects,
  saveProject,
  unsaveProject,
  getFreelancerSettings,
  updateFreelancerSettings,
  getFreelancerAnalytics,
  updateFreelancerCover,
  listFreelancerClients,
  getFreelancerResume,
  putFreelancerResume,
  getFreelancerReferrals,
  getFreelancerEarnings,
  listFreelancerActivity,
} from "../../controllers/freelancer/freelancer-extra.controller.js";

const router = Router();

router.use(authMiddleware as any);
router.use(portalRoleMiddleware(["freelancer"]) as any);

router.get("/dashboard", getFreelancerDashboard as any);
router.get("/profile", getFreelancerProfile as any);
router.patch("/profile", updateFreelancerProfile as any);
router.put("/profile", updateFreelancerProfile as any);
router.patch("/profile/cover", updateFreelancerCover as any);

router.get("/notifications", listFreelancerNotifications as any);
router.patch("/notifications/read-all", markAllFreelancerNotificationsRead as any);
router.patch("/notifications/:id/read", markFreelancerNotificationRead as any);

router.get("/verification", getFreelancerVerification as any);
router.patch("/verification", updateFreelancerVerification as any);

router.get("/portfolio", getFreelancerPortfolio as any);
router.post("/portfolio", createFreelancerPortfolioItem as any);
router.patch("/portfolio/:id", updateFreelancerPortfolioItem as any);
router.delete("/portfolio/:id", deleteFreelancerPortfolioItem as any);

router.get("/proposals", listFreelancerProposals as any);
router.post("/proposals", createFreelancerProposal as any);
router.post("/proposals/:id/withdraw", withdrawFreelancerProposal as any);

router.get("/contracts", listFreelancerContracts as any);

router.get("/tasks", listFreelancerTasks as any);
router.patch("/tasks/:id", updateFreelancerTask as any);

router.get("/meetings", listFreelancerMeetings as any);

router.get("/messages", listFreelancerMessages as any);
router.post("/messages", createFreelancerMessage as any);

router.get("/reviews", listFreelancerReviews as any);

router.post("/wallet/withdraw", withdrawFreelancerWallet as any);

router.get("/invoices", listFreelancerInvoices as any);

router.get("/subscriptions", listFreelancerSubscriptions as any);
router.post("/subscriptions/purchase", purchaseFreelancerSubscription as any);

router.get("/experience", getFreelancerExperience as any);
router.put("/experience", putFreelancerExperience as any);

router.get("/education", getFreelancerEducation as any);
router.put("/education", putFreelancerEducation as any);

router.get("/certificates", getFreelancerCertificates as any);
router.put("/certificates", putFreelancerCertificates as any);

router.get("/skills", getFreelancerSkills as any);
router.put("/skills", putFreelancerSkills as any);

router.get("/saved-projects", listSavedProjects as any);
router.post("/saved-projects", saveProject as any);
router.delete("/saved-projects/:id", unsaveProject as any);

router.get("/settings", getFreelancerSettings as any);
router.patch("/settings", updateFreelancerSettings as any);

router.get("/analytics", getFreelancerAnalytics as any);

router.get("/clients", listFreelancerClients as any);
router.get("/resume", getFreelancerResume as any);
router.put("/resume", putFreelancerResume as any);
router.get("/referrals", getFreelancerReferrals as any);
router.get("/earnings", getFreelancerEarnings as any);
router.get("/activity", listFreelancerActivity as any);

// Portal media upload (images/docs for avatar, verification, portfolio)
router.post("/media/upload", upload.single("file"), uploadFile as any);

export default router;
