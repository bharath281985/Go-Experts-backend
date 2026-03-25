const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    duration_days: {
        type: Number,
        required: true
    },
    points_granted: {
        type: Number,
        required: true
    },
    project_post_limit: {
        type: Number,
        required: true,
        default: 3 // For free plan
    },
    project_visit_limit: { type: Number, required: true, default: 36 },
    portfolio_visit_limit: { type: Number, required: true, default: 36 },
    interest_click_limit: { type: Number, required: true, default: 36 },
    features: [{ type: String }],
    status: { type: String, enum: ['enabled', 'disabled'], default: 'enabled' },
    billing_cycle: { type: String, enum: ['monthly', 'yearly', 'one-time'], default: 'one-time' },
    target_role: { 
        type: String, 
        enum: ['client', 'freelancer', 'investor', 'startup_creator', 'both'], 
        default: 'client' 
    },
    badge: { type: String, default: '' }, // e.g. "Popular", "Popular", "Enterprise"
    featured: { type: Boolean, default: false },
    cta: { type: String, default: 'Get Started' },
    description: { type: String, default: '' },
    group: { 
        type: String, 
        enum: ['Freelancer Plans', 'Client Plans', 'Start-Up Idea Creator Plans', 'Investor Plans', 'Combo Plan'],
        default: 'Freelancer Plans'
    }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
