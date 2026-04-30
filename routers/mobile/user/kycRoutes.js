const express = require('express');
const router = express.Router();
const kycController = require('../../../controller/mobile/user/kycController');
const upload = require('../../../middleware/upload');

router.get('/kyc', kycController.getMobileKYC);
router.put('/kyc', upload.fields([
    { name: 'profile_photo', maxCount: 1 },
    { name: 'pan_card', maxCount: 1 },
    { name: 'aadhar_card', maxCount: 1 },
    { name: 'passport', maxCount: 1 },
    { name: 'driving_license', maxCount: 1 },
    { name: 'address_proof', maxCount: 1 },
    { name: 'cancelled_cheque', maxCount: 1 },
    { name: 'pitch_deck', maxCount: 1 },
    { name: 'business_plan', maxCount: 1 },
    { name: 'financial_projections', maxCount: 1 },
    { name: 'demo_screenshots', maxCount: 5 },
    { name: 'inc_certificate', maxCount: 1 },
    { name: 'gst_certificate', maxCount: 1 },
    { name: 'company_pan', maxCount: 1 },
    { name: 'startup_india_cert', maxCount: 1 },
    { name: 'digital_signature', maxCount: 1 },
    { name: 'academic_certificates', maxCount: 10 },
    { name: 'experience_letter', maxCount: 1 }
]), kycController.updateMobileKYC);

module.exports = router;
