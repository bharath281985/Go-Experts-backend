const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    freelancer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        trim: true
    },
    // Optional: link review to a completed order
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GigOrder'
    }
}, { timestamps: true });

// One review per client per freelancer
reviewSchema.index({ freelancer_id: 1, reviewer_id: 1 }, { unique: true });

// After saving a review, recompute the freelancer's avg rating on the User doc
reviewSchema.post('save', async function () {
    const Review = mongoose.model('Review');
    const User = mongoose.model('User');
    const stats = await Review.aggregate([
        { $match: { freelancer_id: this.freelancer_id } },
        { $group: { _id: '$freelancer_id', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    if (stats.length > 0) {
        await User.findByIdAndUpdate(this.freelancer_id, {
            review_score: +stats[0].avg.toFixed(1),
            review_count: stats[0].count
        });
    }
});

// Also recompute after deletion
reviewSchema.post('findOneAndDelete', async function (doc) {
    if (!doc) return;
    const Review = mongoose.model('Review');
    const User = mongoose.model('User');
    const stats = await Review.aggregate([
        { $match: { freelancer_id: doc.freelancer_id } },
        { $group: { _id: '$freelancer_id', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    if (stats.length > 0) {
        await User.findByIdAndUpdate(doc.freelancer_id, {
            review_score: +stats[0].avg.toFixed(1),
            review_count: stats[0].count
        });
    } else {
        await User.findByIdAndUpdate(doc.freelancer_id, { review_score: 0, review_count: 0 });
    }
});

module.exports = mongoose.model('Review', reviewSchema);
