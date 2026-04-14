const Review = require('../models/Review');
const User = require('../models/User');

// @desc    Submit a review for a freelancer
// @route   POST /api/reviews/:freelancerId
// @access  Private (clients only)
exports.submitReview = async (req, res) => {
    try {
        const freelancerId = req.params.freelancerId;
        const reviewerId = req.user.id;
        const { rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }

        // Prevent reviewing yourself
        if (freelancerId === reviewerId) {
            return res.status(400).json({ success: false, message: 'You cannot review your own profile' });
        }

        // Upsert so a client can update their existing review
        const existing = await Review.findOne({ freelancer_id: freelancerId, reviewer_id: reviewerId });
        let review;
        if (existing) {
            existing.rating = rating;
            existing.comment = comment || existing.comment;
            review = await existing.save();
        } else {
            review = await Review.create({
                freelancer_id: freelancerId,
                reviewer_id: reviewerId,
                rating,
                comment
            });
        }

        res.status(201).json({ success: true, data: review, message: existing ? 'Review updated' : 'Review submitted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all reviews for a freelancer
// @route   GET /api/reviews/:freelancerId
// @access  Public
exports.getReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ freelancer_id: req.params.freelancerId })
            .populate('reviewer_id', 'full_name profile_image role')
            .sort({ createdAt: -1 });

        const count = reviews.length;
        const avg = count > 0
            ? +(reviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1)
            : 0;

        res.json({ success: true, data: reviews, average: avg, count });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete own review
// @route   DELETE /api/reviews/:reviewId
// @access  Private
exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findOneAndDelete({
            _id: req.params.reviewId,
            reviewer_id: req.user.id
        });
        if (!review) return res.status(404).json({ success: false, message: 'Review not found or not yours' });
        res.json({ success: true, message: 'Review deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
