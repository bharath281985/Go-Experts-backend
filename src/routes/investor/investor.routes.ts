import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { uploadFile } from "../../controllers/media/media.controller.js";
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
} from "../../controllers/investor/investor.controller.js";

const router = Router();

router.use(authMiddleware as any);
router.use(portalRoleMiddleware(["investor"]) as any);

router.get("/dashboard", getInvestorDashboard as any);

router.get("/profile", getInvestorProfile as any);
router.patch("/profile", updateInvestorProfile as any);
router.put("/profile", updateInvestorProfile as any);

router.get("/watchlist", listWatchlist as any);
router.post("/watchlist", addToWatchlist as any);
router.delete("/watchlist/:id", removeFromWatchlist as any);

router.get("/portfolio", getInvestorPortfolio as any);

router.get("/investments", listInvestorInvestments as any);
router.post("/investments", createInvestorInvestment as any);

router.get("/meetings", listInvestorMeetings as any);
router.post("/meetings", createInvestorMeeting as any);

router.get("/messages", listInvestorMessages as any);
router.post("/messages", createInvestorMessage as any);

router.get("/wallet", getInvestorWallet as any);
router.post("/wallet/deposit", depositInvestorWallet as any);
router.post("/wallet/withdraw", withdrawInvestorWallet as any);

router.get("/invoices", listInvestorInvoices as any);

router.get("/analytics", getInvestorAnalytics as any);
router.get("/reports", getInvestorReports as any);

router.get("/notifications", listInvestorNotifications as any);
router.patch("/notifications/read-all", markAllInvestorNotificationsRead as any);
router.patch("/notifications/:id/read", markInvestorNotificationRead as any);

router.get("/documents", listInvestorDocuments as any);
router.post("/documents", addInvestorDocument as any);

router.get("/subscription", listInvestorSubscriptions as any);
router.post("/subscription/purchase", purchaseInvestorSubscription as any);

router.get("/settings", getInvestorSettings as any);
router.patch("/settings", updateInvestorSettings as any);

router.post("/media/upload", upload.single("file"), uploadFile as any);

export default router;
