const mongoose = require('mongoose');

const investorOpportunitySchema = new mongoose.Schema({
    investor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startup_idea: { type: mongoose.Schema.Types.ObjectId, ref: 'StartupIdea', required: true },
    status: { 
        type: String, 
        enum: ['viewed', 'saved', 'shortlisted', 'interested', 'archived'], 
        default: 'viewed' 
    },
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    score: { type: String }, // e.g., 'A', 'B+', etc.
    next_step: { type: String },
    last_viewed: { type: Date, default: Date.now },
    notes: { type: String }
}, { timestamps: true });

// Ensure unique combination of investor and idea
investorOpportunitySchema.index({ investor: 1, startup_idea: 1 }, { unique: true });

module.exports = mongoose.model('InvestorOpportunity', investorOpportunitySchema);
