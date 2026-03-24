const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
    name: { type: String, required: true },
    role: { type: String, required: true },
    rating: { type: Number, default: 5 },
    text: { type: String, required: true },
    avatar: { type: String, default: '' }, // Emoji or image URL
    is_active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', testimonialSchema);
