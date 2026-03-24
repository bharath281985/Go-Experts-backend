const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Banner title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    subtitle: {
        type: String,
        trim: true,
        maxlength: [500, 'Subtitle cannot exceed 500 characters']
    },
    image_url: {
        type: String,
        default: ''
    },
    link_url: {
        type: String,
        default: ''
    },
    link_text: {
        type: String,
        default: 'Learn More'
    },
    position: {
        type: String,
        enum: ['hero', 'sidebar', 'footer', 'popup', 'category'],
        default: 'hero'
    },
    is_active: {
        type: Boolean,
        default: true
    },
    sort_order: {
        type: Number,
        default: 0
    },
    start_date: {
        type: Date,
        default: null
    },
    end_date: {
        type: Date,
        default: null
    },
    target_audience: {
        type: String,
        enum: ['all', 'freelancer', 'client'],
        default: 'all'
    }
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
