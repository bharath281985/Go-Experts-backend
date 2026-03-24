const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: [1, 'Amount must be at least 1']
    },
    payment_method: {
        type: String,
        required: true,
        enum: ['Bank Transfer', 'UPI', 'PayPal']
    },
    payment_details: {
        type: Object,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    admin_note: String,
    processed_at: Date,
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
