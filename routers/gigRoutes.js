const express = require('express');
const router = express.Router();
const { 
    createGig, 
    getGigs, 
    getGigById, 
    getMyGigs,
    updateGig,
    deleteGig
} = require('../controller/gigController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
    .get(getGigs)
    .post(protect, authorize('freelancer'), upload.any(), createGig);

router.get('/my', protect, authorize('freelancer'), getMyGigs);

router.route('/:id')
    .get(getGigById)
    .put(protect, authorize('freelancer'), upload.any(), updateGig)
    .delete(protect, authorize('freelancer'), deleteGig);

module.exports = router;
