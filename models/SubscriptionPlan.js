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
    points_granted: { type: Number, default: 0 },
    project_post_limit: { type: Number, default: 0 },
    task_post_limit: { type: Number, default: 0 },
    chat_limit: { type: Number, default: 0 },
    database_access_limit: { type: Number, default: 0 },
    project_visit_limit: { type: Number, default: 0 },
    portfolio_visit_limit: { type: Number, default: 0 },
    interest_click_limit: { type: Number, default: 0 },
    startup_idea_post_limit: { type: Number, default: 0 },
    startup_idea_explore_limit: { type: Number, default: 0 },
    features: [{ type: String }],
    status: { type: String, enum: ['enabled', 'disabled'], default: 'enabled' },
    billing_cycle: { type: String, enum: ['yearly', 'monthly', 'one-time'], default: 'yearly' },
    featured: { type: Boolean, default: false },
    badge: { type: String },
    cta: { type: String, default: 'Choose Plan' },
    description: { type: String },
    target_role: [{ 
        type: String, 
        enum: ['client', 'freelancer', 'investor', 'startup_creator', 'both']
    }],
    group: [{
        type: String,
        enum: ['Free Trial Plan', 'Freelancer Plans', 'Client Plans', 'Start-Up Idea Creator Plans', 'Investor Plans', 'Combo Plan']
    }],
    icon: { type: String, default: 'Star' }, // Lucide icon name
    color_theme: { 
        type: String, 
        enum: ['orange', 'green', 'blue', 'gold'], 
        default: 'orange' 
    }
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
