const mongoose = require('mongoose');

const gigOrderSchema = new mongoose.Schema({
    gig_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gig',
        required: true
    },
    buyer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    seller_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    service_fee: {
        type: Number,
        default: 0
    },
    total_amount: {
        type: Number,
        required: true
    },
    package: {
        type: String,
        enum: ['basic', 'standard', 'premium'],
        required: true,
        default: 'standard'
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'delivered', 'completed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    requirements: {
        type: String
    },
    files: [{
        name: String,
        url: String,
        size: String
    }],
    payment_status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    payment_info: {
        method: String,
        transaction_id: String
    },
    orderID: {
        type: String,
        unique: true
    },
    delivery_date: {
        type: Date
    }
}, { timestamps: true });

gigOrderSchema.post('save', async function (doc) {
    if (doc.payment_status === 'paid') {
        const Invoice = mongoose.model('Invoice');
        const existing = await Invoice.findOne({ order_id: doc._id });
        if (!existing) {
            await Invoice.create({
                invoice_number: `INV-${Date.now()}-${doc._id.toString().slice(-4)}`,
                user: doc.buyer_id,
                order_id: doc._id,
                onModel: 'GigOrder',
                amount: doc.total_amount,
                status: 'paid',
                paid_at: new Date()
            });
        }
    }
});

module.exports = mongoose.model('GigOrder', gigOrderSchema);
