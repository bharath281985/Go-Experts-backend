const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');

// Sub-Routers
const profileRoutes = require('./user/profileRoutes');
const kycRoutes = require('./user/kycRoutes');
const walletRoutes = require('./user/walletRoutes');
const landingPageRoutes = require('./user/landingPageRoutes');
const resumeRoutes = require('./user/resumeRoutes');
const portfolioRoutes = require('./user/portfolioRoutes');

// All mobile user routes are protected
router.use(protect);

// Mount Sub-Routers at the root of /api/mobile/user/
// Each sub-router now defines its own specific paths (e.g., /me, /kyc, /portfolio)
router.use('/', profileRoutes);
router.use('/', kycRoutes);
router.use('/', walletRoutes);
router.use('/', landingPageRoutes);
router.use('/', resumeRoutes);
router.use('/', portfolioRoutes);

module.exports = router;
