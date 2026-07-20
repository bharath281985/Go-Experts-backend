import { Router } from "express";
import {
  // Plans
  listPlans, createPlan, updatePlan,
  // Subscriptions
  purchaseSubscription, renewSubscription, cancelSubscription, upgradeSubscription,
  listAllSubscriptions, getSubscriptionHistory,
  // Usage
  trackUsage, getUsage,
  // Wallet
  getWallet, creditWallet, debitWallet, addWalletBonus,
  // Payments & Refunds
  listPayments, processRefund, listRefunds,
  // Coupons
  validateCoupon, listCouponUsages,
  // Referrals
  createReferral, rewardReferral, listReferrals,
  // Ads
  listAdPlans, createAdPlan, listAds, approveAd, rejectAd,
  // Featured
  listFeaturedServices, createFeaturedService,
  // Invoices
  listInvoices, getInvoice,
  // Dashboard
  getFinancialDashboard,
} from "../../controllers/financials/financials.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware as any);

// ── Plans ──
router.get("/plans", listPlans as any);
router.post("/plans", createPlan as any);
router.put("/plans/:id", updatePlan as any);

// ── Subscriptions ──
router.get("/subscriptions", listAllSubscriptions as any);
router.post("/subscriptions/purchase", purchaseSubscription as any);
router.post("/subscriptions/renew", renewSubscription as any);
router.post("/subscriptions/cancel", cancelSubscription as any);
router.post("/subscriptions/upgrade", upgradeSubscription as any);
router.get("/subscriptions/history/:userId", getSubscriptionHistory as any);

// ── Usage ──
router.post("/usage/track", trackUsage as any);
router.get("/usage/:subscriptionId", getUsage as any);

// ── Wallet ──
router.get("/wallet/:userId", getWallet as any);
router.post("/wallet/credit", creditWallet as any);
router.post("/wallet/debit", debitWallet as any);
router.post("/wallet/bonus", addWalletBonus as any);

// ── Payments ──
router.get("/payments", listPayments as any);
router.post("/payments/refund", processRefund as any);
router.get("/refunds", listRefunds as any);

// ── Coupons ──
router.post("/coupons/validate", validateCoupon as any);
router.get("/coupons/:couponId/usages", listCouponUsages as any);

// ── Referrals ──
router.get("/referrals", listReferrals as any);
router.post("/referrals", createReferral as any);
router.post("/referrals/reward", rewardReferral as any);

// ── Advertisements ──
router.get("/ad-plans", listAdPlans as any);
router.post("/ad-plans", createAdPlan as any);
router.get("/ads", listAds as any);
router.patch("/ads/:id/approve", approveAd as any);
router.patch("/ads/:id/reject", rejectAd as any);

// ── Featured Services ──
router.get("/featured-services", listFeaturedServices as any);
router.post("/featured-services", createFeaturedService as any);

// ── Invoices ──
router.get("/invoices", listInvoices as any);
router.get("/invoices/:id", getInvoice as any);

// ── Dashboard ──
router.get("/dashboard", getFinancialDashboard as any);

export default router;
