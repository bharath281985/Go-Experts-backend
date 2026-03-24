const mongoose = require('mongoose');

const savedGigSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    gig: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gig',
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Unique index to prevent duplicates
savedGigSchema.index({ user: 1, gig: 1 }, { unique: true });

module.exports = mongoose.model('SavedGig', savedGigSchema);
