const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
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
    start_date: {
        type: Date,
        default: Date.now
    },
    end_date: {
        type: Date,
        required: true
    },
    remaining_project_posts: { type: Number, default: 36 },
    remaining_task_posts: { type: Number, default: 0 },
    remaining_chats: { type: Number, default: 0 },
    remaining_db_access: { type: Number, default: 0 },
    remaining_startup_posts: { type: Number, default: 0 },
    remaining_idea_unlocks: { type: Number, default: 0 },
    remaining_interest_clicks: {
        type: Number,
        default: 36
    },
    remaining_project_visits: {
        type: Number,
        default: 36
    },
    remaining_portfolio_visits: {
        type: Number,
        default: 36
    },
    reminder_sent_10d: {
        type: Boolean,
        default: false
    },
    reminder_sent_3d: {
        type: Boolean,
        default: false
    },
    reminder_sent_exp: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'expired'],
        default: 'active'
    }
}, { timestamps: true });

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
