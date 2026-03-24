const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    plan_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        required: true
    },
    payment_id: { // Internal ID
        type: String,
        unique: true,
        required: true
    },
    txnid: { // Easebuzz transaction ID
        type: String,
        unique: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['initiated', 'success', 'failure', 'pending'],
        default: 'initiated'
    },
    easebuzz_response: {
        type: Object
    },
    payment_method: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
