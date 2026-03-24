const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
    freelancer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String, // Idea ready for investment
        required: [true, 'Please add a gig title']
    },
    description: {
        type: String,
        required: true
    },
    investment_required: {
        type: Number,
        required: true
    },
    category: String,
    thumbnail: String, // Path to image
    tags: [String],
    status: {
        type: String,
        enum: ['pending', 'live', 'closed', 'paused'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Gig', gigSchema);
