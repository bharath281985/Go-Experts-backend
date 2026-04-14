const express = require('express');
const router = express.Router();
const { submitReview, getReviews, deleteReview } = require('../controller/reviewController');
const { protect } = require('../middleware/auth');

router.get('/:freelancerId', getReviews);
router.post('/:freelancerId', protect, submitReview);
router.delete('/:reviewId', protect, deleteReview);

module.exports = router;
