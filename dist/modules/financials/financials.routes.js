import { Router } from "express";
import { 
// Plans
listPlans, createPlan, updatePlan, 
// Subscriptions
purchaseSubscription, renewSubscription, cancelSubscription, upgradeSubscription, listAllSubscriptions, getSubscriptionHistory, 
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
getFinancialDashboard, } from "./financials.controller.js";
const router = Router();
// ── Plans ──
router.get("/plans", listPlans);
router.post("/plans", createPlan);
router.put("/plans/:id", updatePlan);
// ── Subscriptions ──
router.get("/subscriptions", listAllSubscriptions);
router.post("/subscriptions/purchase", purchaseSubscription);
router.post("/subscriptions/renew", renewSubscription);
router.post("/subscriptions/cancel", cancelSubscription);
router.post("/subscriptions/upgrade", upgradeSubscription);
router.get("/subscriptions/history/:userId", getSubscriptionHistory);
// ── Usage ──
router.post("/usage/track", trackUsage);
router.get("/usage/:subscriptionId", getUsage);
// ── Wallet ──
router.get("/wallet/:userId", getWallet);
router.post("/wallet/credit", creditWallet);
router.post("/wallet/debit", debitWallet);
router.post("/wallet/bonus", addWalletBonus);
// ── Payments ──
router.get("/payments", listPayments);
router.post("/payments/refund", processRefund);
router.get("/refunds", listRefunds);
// ── Coupons ──
router.post("/coupons/validate", validateCoupon);
router.get("/coupons/:couponId/usages", listCouponUsages);
// ── Referrals ──
router.get("/referrals", listReferrals);
router.post("/referrals", createReferral);
router.post("/referrals/reward", rewardReferral);
// ── Advertisements ──
router.get("/ad-plans", listAdPlans);
router.post("/ad-plans", createAdPlan);
router.get("/ads", listAds);
router.patch("/ads/:id/approve", approveAd);
router.patch("/ads/:id/reject", rejectAd);
// ── Featured Services ──
router.get("/featured-services", listFeaturedServices);
router.post("/featured-services", createFeaturedService);
// ── Invoices ──
router.get("/invoices", listInvoices);
router.get("/invoices/:id", getInvoice);
// ── Dashboard ──
router.get("/dashboard", getFinancialDashboard);
export default router;
