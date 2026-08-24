import { Router } from "express";
import { respondToInvitation, listFreelancerInvitations } from "../../controllers/freelancer/freelancer-extra.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/media/media.controller.js";
import {
  searchPublishedProjects,
  acceptOffer,
  withdrawProposal,
  getFreelancerDashboard,
  getFreelancerProfile,
  updateFreelancerProfile,
  listFreelancerNotifications,
  markFreelancerNotificationRead,
  markAllFreelancerNotificationsRead,
  getFreelancerPortfolio,
  getFreelancerPortfolioItem,
  createFreelancerPortfolioItem,
  updateFreelancerPortfolioItem,
  deleteFreelancerPortfolioItem,
} from "../../controllers/freelancer/freelancer.controller.js";
import { getMyVerification, updateMyVerification, deleteMyVerification } from "../../controllers/verification/verification.controller.js";
import {
  listFreelancerProposals,
  createFreelancerProposal,
  withdrawFreelancerProposal,
  listFreelancerContracts,
  listFreelancerTasks,
  updateFreelancerTask,
  listFreelancerMeetings,
  createFreelancerMeeting,
  createFreelancerNotification,
  listFreelancerMessages,
  createFreelancerMessage,
  listFreelancerReviews,
  getFreelancerWallet,
  withdrawFreelancerWallet,
  listFreelancerInvoices,
  listFreelancerSubscriptions,
  purchaseFreelancerSubscription,
  getFreelancerExperience,
  putFreelancerExperience,
  getFreelancerEducation,
  putFreelancerEducation,
  postFreelancerEducation,
  deleteFreelancerEducation,
  putFreelancerEducationById,
  getFreelancerCertificates,
  putFreelancerCertificates,
  postFreelancerCertificates,
  deleteFreelancerCertificates,
  putFreelancerCertificateById,
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
  exportFreelancerResumePdf,
  getFreelancerReferrals,
  getFreelancerEarnings,
  listFreelancerActivity,
  createFreelancerActivity,
} from "../../controllers/freelancer/freelancer-extra.controller.js";

import {
  getFreelancerResumeShare,
  createFreelancerResumeShare,
  updateFreelancerResumeShare,
  regenerateFreelancerResumeShare,
  updateFreelancerResumeShareSnapshot,
  deleteFreelancerResumeShare
} from "../../controllers/freelancer/freelancer-resume-share.controller.js";

const router = Router();

router.use(authMiddleware as any);
router.use(requireOnboarding as any);
router.use(portalRoleMiddleware(["freelancer", "client", "investor", "founder", "admin", "super_admin"]) as any);

router.get("/projects", searchPublishedProjects as any);
router.post("/projects/search", searchPublishedProjects as any);
router.get("/dashboard", getFreelancerDashboard as any);
router.get("/professional", getFreelancerProfile as any);
router.patch("/professional", updateFreelancerProfile as any);
router.put("/professional", updateFreelancerProfile as any);
router.patch("/professional/cover", updateFreelancerCover as any);

router.get("/profile", getFreelancerProfile as any);
router.patch("/profile", updateFreelancerProfile as any);
router.put("/profile", updateFreelancerProfile as any);
router.patch("/profile/cover", updateFreelancerCover as any);

router.get("/notifications", listFreelancerNotifications as any);
router.post("/notifications", createFreelancerNotification as any);
router.patch("/notifications/read-all", markAllFreelancerNotificationsRead as any);
router.patch("/notifications/:id/read", markFreelancerNotificationRead as any);

router.get("/verification", getMyVerification as any);
router.patch("/verification", updateMyVerification as any);
router.delete("/verification", deleteMyVerification as any);

router.get("/portfolio", getFreelancerPortfolio as any);
router.get("/portfolio/:id", getFreelancerPortfolioItem as any);
router.post("/portfolio", createFreelancerPortfolioItem as any);
router.patch("/portfolio/:id", updateFreelancerPortfolioItem as any);
router.delete("/portfolio/:id", deleteFreelancerPortfolioItem as any);

router.get("/invitations", listFreelancerInvitations as any);
router.post("/invitations/:id/respond", respondToInvitation as any);
router.get("/proposals", listFreelancerProposals as any);
router.post("/proposals", createFreelancerProposal as any);
router.post("/proposals/:id/withdraw", withdrawProposal as any);
router.post("/proposals/:id/accept-offer", acceptOffer as any);
// , withdrawFreelancerProposal as any);

router.get("/contracts", listFreelancerContracts as any);

router.get("/tasks", listFreelancerTasks as any);
router.patch("/tasks/:id", updateFreelancerTask as any);

router.get("/meetings", listFreelancerMeetings as any);
router.post("/meetings", createFreelancerMeeting as any);

router.get("/messages", listFreelancerMessages as any);
router.post("/messages", createFreelancerMessage as any);

router.get("/reviews", listFreelancerReviews as any);

router.get("/wallet", getFreelancerWallet as any);
router.post("/wallet/withdraw", withdrawFreelancerWallet as any);

router.get("/invoices", listFreelancerInvoices as any);

router.get("/subscriptions", listFreelancerSubscriptions as any);
router.post("/subscriptions/purchase", purchaseFreelancerSubscription as any);

router.get("/experience", getFreelancerExperience as any);
router.put("/experience", putFreelancerExperience as any);

router.get("/education", getFreelancerEducation as any);
router.put("/education", putFreelancerEducation as any);
router.post("/education", postFreelancerEducation as any);
router.put("/education/:id", putFreelancerEducationById as any);
router.patch("/education/:id", putFreelancerEducationById as any);
router.delete("/education/:id", deleteFreelancerEducation as any);

router.get("/certificates", getFreelancerCertificates as any);
router.put("/certificates", putFreelancerCertificates as any);
router.post("/certificates", postFreelancerCertificates as any);
router.put("/certificates/:id", putFreelancerCertificateById as any);
router.patch("/certificates/:id", putFreelancerCertificateById as any);
router.delete("/certificates/:id", deleteFreelancerCertificates as any);

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
router.post("/resume/export/pdf", exportFreelancerResumePdf as any);

router.get("/resume/share", getFreelancerResumeShare as any);
router.post("/resume/share", createFreelancerResumeShare as any);
router.put("/resume/share", updateFreelancerResumeShare as any);
router.post("/resume/share/regenerate", regenerateFreelancerResumeShare as any);
router.post("/resume/share/update-snapshot", updateFreelancerResumeShareSnapshot as any);
router.delete("/resume/share", deleteFreelancerResumeShare as any);

router.get("/referrals", getFreelancerReferrals as any);
router.get("/earnings", getFreelancerEarnings as any);
router.get("/activity", listFreelancerActivity as any);
router.post("/activity", createFreelancerActivity as any);

// Portal media upload (images/docs for avatar, verification, portfolio)
router.post("/media/upload", upload.single("file"), uploadFile as any);

export default router;
