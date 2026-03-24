const mongoose = require('mongoose');

const projectInterestSchema = new mongoose.Schema({
    project_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    freelancer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: String,
    bid_amount: Number,
    delivery_time: String,
    portfolio_link: String,
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

// Unique index to prevent multiple interests from same freelancer on same project
projectInterestSchema.index({ project_id: 1, freelancer_id: 1 }, { unique: true });

module.exports = mongoose.model('ProjectInterest', projectInterestSchema);
