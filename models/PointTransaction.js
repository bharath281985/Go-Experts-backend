const mongoose = require('mongoose');

const pointTransactionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true // Negative for spending, positive for purchase/bonus
    },
    type: {
        type: String,
        enum: ['subscription_purchase', 'project_post', 'interest_expression', 'daily_expiry', 'withdrawal', 'bonus'],
        required: true
    },
    related_entity_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: false // Link to project_id or plan_id
    },
    description: String,
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PointTransaction', pointTransactionSchema);
