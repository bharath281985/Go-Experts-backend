import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/media/media.controller.js";
import { getMyVerification, updateMyVerification, deleteMyVerification } from "../../controllers/verification/verification.controller.js";
import {
  getInvestorDashboard,
  getInvestorProfile,
  updateInvestorProfile,
  listWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  getInvestorPortfolio,
  listInvestorInvestments,
  createInvestorInvestment,
  listInvestorMeetings,
  createInvestorMeeting,
  listInvestorMessages,
  createInvestorMessage,
  getInvestorWallet,
  depositInvestorWallet,
  withdrawInvestorWallet,
  listInvestorInvoices,
  getInvestorAnalytics,
  getInvestorReports,
  listInvestorNotifications,
  markInvestorNotificationRead,
  markAllInvestorNotificationsRead,
  listInvestorDocuments,
  addInvestorDocument,
  listInvestorSubscriptions,
  purchaseInvestorSubscription,
  getInvestorSettings,
  updateInvestorSettings,
  listAllFounders,
  listInvestorReviews,
} from "../../controllers/investor/investor.controller.js";

const router = Router();

router.use(authMiddleware as any);
router.use(requireOnboarding as any);

// ── Shared Portal Routes (accessible to all authenticated portal roles: investor, freelancer, client, founder) ──
router.get("/watchlist", listWatchlist as any);
router.post("/watchlist", addToWatchlist as any);
router.delete("/watchlist/:id", removeFromWatchlist as any);

router.get("/portfolio", getInvestorPortfolio as any);
router.get("/investments", listInvestorInvestments as any);
router.post("/investments", createInvestorInvestment as any);

// ── Investor-Specific Routes (requires portal role) ──
const investorOnly = portalRoleMiddleware(["investor", "client", "founder", "freelancer", "admin", "super_admin"]) as any;

router.get("/dashboard", investorOnly, getInvestorDashboard as any);

router.get("/profile", investorOnly, getInvestorProfile as any);
router.patch("/profile", investorOnly, updateInvestorProfile as any);
router.put("/profile", investorOnly, updateInvestorProfile as any);

router.get("/verification", investorOnly, getMyVerification as any);
router.patch("/verification", investorOnly, updateMyVerification as any);
router.delete("/verification", investorOnly, deleteMyVerification as any);

router.get("/meetings", investorOnly, listInvestorMeetings as any);
router.post("/meetings", investorOnly, createInvestorMeeting as any);

router.get("/messages", investorOnly, listInvestorMessages as any);
router.post("/messages", investorOnly, createInvestorMessage as any);

router.get("/wallet", investorOnly, getInvestorWallet as any);
router.post("/wallet/deposit", investorOnly, depositInvestorWallet as any);
router.post("/wallet/withdraw", investorOnly, withdrawInvestorWallet as any);

router.get("/invoices", investorOnly, listInvestorInvoices as any);

router.get("/analytics", investorOnly, getInvestorAnalytics as any);
router.get("/reports", investorOnly, getInvestorReports as any);

router.get("/notifications", investorOnly, listInvestorNotifications as any);
router.patch("/notifications/read-all", investorOnly, markAllInvestorNotificationsRead as any);
router.patch("/notifications/:id/read", investorOnly, markInvestorNotificationRead as any);

router.get("/documents", investorOnly, listInvestorDocuments as any);
router.post("/documents", investorOnly, addInvestorDocument as any);

router.get("/subscription", investorOnly, listInvestorSubscriptions as any);
router.post("/subscription/purchase", investorOnly, purchaseInvestorSubscription as any);

router.get("/settings", investorOnly, getInvestorSettings as any);
router.patch("/settings", investorOnly, updateInvestorSettings as any);

router.get("/all-founders", investorOnly, listAllFounders as any);

router.post("/media/upload", investorOnly, upload.single("file"), uploadFile as any);

router.get("/reviews", investorOnly, listInvestorReviews as any);

export default router;
