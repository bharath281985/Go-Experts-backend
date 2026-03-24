const express = require('express');
const router = express.Router();
const { 
    getFreelancers, 
    getFreelancerById, 
    getUserStats, 
    getUserTransactions, 
    addMoney, 
    withdrawMoney,
    getMyDisputes,
    getMyInvoices,
    toggleSaveGig,
    getSavedGigs
} = require('../controller/userController');
const { protect } = require('../middleware/auth');

router.get('/freelancers', getFreelancers);
router.get('/freelancers/:id', getFreelancerById);
router.get('/dashboard-stats', protect, getUserStats);
router.get('/transactions', protect, getUserTransactions);
router.post('/add-money', protect, addMoney);
router.post('/withdraw', protect, withdrawMoney);
router.get('/my-disputes', protect, getMyDisputes);
router.get('/my-invoices', protect, getMyInvoices);
router.post('/saved-gigs/:id', protect, toggleSaveGig);
router.get('/saved-gigs', protect, getSavedGigs);

module.exports = router;
