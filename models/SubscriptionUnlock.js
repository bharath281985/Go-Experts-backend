const mongoose = require('mongoose');

const subscriptionUnlockSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    target_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    target_type: {
        type: String,
        enum: ['project', 'freelancer', 'startup_idea'],
        required: true
    },
    unlocked_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Ensure a user doesn't have duplicate unlock records for the same target
subscriptionUnlockSchema.index({ user_id: 1, target_id: 1, target_type: 1 }, { unique: true });

module.exports = mongoose.model('SubscriptionUnlock', subscriptionUnlockSchema);
