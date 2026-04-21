const express = require('express');
const router = express.Router();
const {
    getUsers, createUser, getUserById, updateUser, updateUserRoles,
    deleteUser, getStats, getProjects, toggleProjectFeatured, updateProjectStatus, getGigs, updateGigStatus, deleteGig,
    verifyUser, suspendUser, rejectUser, sendProfileCompletionReminder, resetUserPassword, sendTestEmail, bulkUserAction,
    getDisputes, updateDisputeStatus, getWithdrawRequests, updateWithdrawStatus, sendDirectEmail,
    getContactMessages, deleteContactMessage, adjustUserWallet,
    getAdminStartupIdeas, getAdminStartupIdeaById, updateStartupIdeaStatus, toggleStartupIdeaFeatured,
    getAdminMeetings, getAdminOpportunities
} = require('../controller/adminController');

const {
    getCategories: getStartupCategories,
    addCategory: addStartupCategory,
    updateCategory: updateStartupCategory,
    deleteCategory: deleteStartupCategory
} = require('../controller/startupCategoryController');

const {
    getAdminGigOrders,
    getAdminGigOrderById,
    updateGigOrderStatus
} = require('../controller/gigOrderController');
const { protect, authorize } = require('../middleware/auth');

// All routes here are protected and require admin role
router.use(protect);
router.use(authorize('admin'));

router.get('/ping', (req, res) => res.json({ message: 'admin routes live' }));

// Basic Stats
router.get('/stats', getStats);

// --- User Management ---
router.get('/users', getUsers);
router.post('/users', createUser);
router.post('/users/bulk', bulkUserAction);

// Specific ID-based operations (Fixed order to avoid conflicts)
router.post('/users/:id/remind-complete', sendProfileCompletionReminder);
router.post('/users/:id/reset-password', resetUserPassword);
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/suspend', suspendUser);
router.put('/users/:id/reject', rejectUser);
router.put('/users/:id/roles', updateUserRoles);
router.put('/users/:id/wallet', adjustUserWallet);
router.post('/users/:id/send-email', sendDirectEmail);

// General ID-based operations
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// --- Content & Site Management ---
router.get('/projects', getProjects);
router.put('/projects/:id/featured', toggleProjectFeatured);
router.put('/projects/:id/status' , updateProjectStatus);
router.get('/gigs', getGigs);
router.put('/gigs/:id/status', updateGigStatus);
router.delete('/gigs/:id', deleteGig);

// Startup Ideas
router.get('/startup-ideas', getAdminStartupIdeas);
router.get('/startup-ideas/:id', getAdminStartupIdeaById);
router.put('/startup-ideas/:id/status', updateStartupIdeaStatus);
router.put('/startup-ideas/:id/featured', toggleStartupIdeaFeatured);

// Meetings & Opportunities
router.get('/meetings', getAdminMeetings);
router.get('/opportunities', getAdminOpportunities);

// Startup Categories
router.get('/startup-categories', getStartupCategories);
router.post('/startup-categories', addStartupCategory);
router.put('/startup-categories/:id', updateStartupCategory);
router.delete('/startup-categories/:id', deleteStartupCategory);

// Gig Orders
router.get('/gig-orders', getAdminGigOrders);
router.get('/gig-orders/:id', getAdminGigOrderById);
router.put('/gig-orders/:id/status', updateGigOrderStatus);

// Disputes
router.get('/disputes', getDisputes);
router.put('/disputes/:id', updateDisputeStatus);

// Withdrawals
router.get('/withdrawals', getWithdrawRequests);
router.put('/withdrawals/:id', updateWithdrawStatus);

// Utilities
// Contact Messages
router.get('/contact-messages', getContactMessages);
router.delete('/contact-messages/:id', deleteContactMessage);

module.exports = router;
