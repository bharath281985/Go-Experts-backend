const mongoose = require('mongoose');

const staticPageSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    content: { type: String, default: '' },
    meta_title: { type: String, default: '' },
    meta_description: { type: String, default: '' },
    status: { type: String, enum: ['published', 'draft'], default: 'published' },
    // Extra fields for rich pages like About Us
    vision: { type: String, default: '' },
    vision_icon: { type: String, default: 'Target' },
    mission: { type: String, default: '' },
    mission_icon: { type: String, default: 'Sparkles' },
    mission_points: [{ type: String }],
    differentiators: [{
        label: { type: String },
        description: { type: String },
        icon: { type: String, default: 'ShieldCheck' }
    }],
    responsibilities: { type: String, default: '' },
    image1: { type: String, default: '' },
    image2: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('StaticPage', staticPageSchema);
