const express = require('express');
const router = express.Router();
const { getKYCStatus, submitKYC, updateKYCStatus } = require('../controller/kycController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Get current user's KYC status
router.get('/status', protect, getKYCStatus);

// Upload a single KYC document
router.post('/upload', protect, upload.single('kyc_doc'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a file' });
    res.status(200).json({ 
        success: true, 
        url: `/uploads/kyc/${req.file.filename}` 
    });
});

// Submit or update KYC (as pending)
router.post('/submit', protect, submitKYC);

// Admin-only update status
router.put('/:id/status', protect, authorize('admin'), updateKYCStatus);

module.exports = router;
