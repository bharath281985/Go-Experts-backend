const express = require('express');
const router = express.Router();
const {
    getUsers, createUser, getUserById, updateUser, updateUserRoles,
    deleteUser, getStats, getProjects, getGigs, updateGigStatus, deleteGig,
    verifyUser, suspendUser, rejectUser, sendProfileCompletionReminder, sendTestEmail, bulkUserAction,
    getDisputes, updateDisputeStatus, getWithdrawRequests, updateWithdrawStatus, sendDirectEmail,
    getContactMessages, deleteContactMessage
} = require('../controller/adminController');
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
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/suspend', suspendUser);
router.put('/users/:id/reject', rejectUser);
router.put('/users/:id/roles', updateUserRoles);
router.post('/users/:id/send-email', sendDirectEmail);

// General ID-based operations
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// --- Content & Site Management ---
router.get('/projects', getProjects);
router.get('/gigs', getGigs);
router.put('/gigs/:id/status', updateGigStatus);
router.delete('/gigs/:id', deleteGig);

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
